/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import { createWriteStream, existsSync } from 'node:fs';
import { chmod, copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import * as tar from 'tar';

import { sha256 } from './sha256';

const REGISTRY = 'https://ghcr.io';
const REPOSITORY = 'homebrew/core/e2fsprogs';
const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');
const METADATA_TIMEOUT_MS = 30_000;
const BOTTLE_DOWNLOAD_TIMEOUT_MS = 5 * 60_000;

const LIBRARIES = ['libcom_err.so.2', 'libe2p.so.2', 'libext2fs.so.2', 'libss.so.2'];
const RUNTIME_DIRECTORY = 'e2fsprogs';
const BINARIES = [
  { name: 'mkfs.ext4', payload: 'mke2fs' },
  { name: 'debugfs', payload: 'debugfs' },
];

interface OciDescriptor {
  mediaType: string;
  digest: string;
  platform?: {
    architecture: string;
    os: string;
  };
  annotations?: Record<string, string>;
}

interface OciIndex {
  manifests: OciDescriptor[];
}

interface OciManifest {
  layers: OciDescriptor[];
}

interface RegistryToken {
  token?: string;
  access_token?: string;
}

function architectureForOci(arch: string): string {
  if (arch === 'x64') return 'amd64';
  if (arch === 'arm64') return 'arm64';
  throw new Error(`unsupported e2fsprogs architecture: ${arch}`);
}

function isRequiredBottleEntry(path: string, type: string, version: string): boolean {
  if (type === 'Link' || type === 'SymbolicLink') {
    return false;
  }
  const bottleRoot = `e2fsprogs/${version}`;
  const requiredPaths = [
    ...BINARIES.map(binary => `${bottleRoot}/sbin/${binary.payload}`),
    `${bottleRoot}/.bottle/etc/mke2fs.conf`,
    `${bottleRoot}/NOTICE`,
  ];
  return (
    requiredPaths.some(
      requiredPath => path === requiredPath || requiredPath.startsWith(`${path.replace(/\/$/, '')}/`),
    ) || LIBRARIES.some(library => path.startsWith(`${bottleRoot}/lib/${library}.`))
  );
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function getRegistryToken(): Promise<string> {
  const query = new URLSearchParams({ service: 'ghcr.io', scope: `repository:${REPOSITORY}:pull` });
  const result = await fetchJson<RegistryToken>(`${REGISTRY}/token?${query.toString()}`);
  const token = result.token ?? result.access_token;
  if (!token) {
    throw new Error('e2fsprogs registry response did not include an access token');
  }
  return token;
}

async function getManifest<T>(reference: string, token: string): Promise<T> {
  return fetchJson<T>(`${REGISTRY}/v2/${REPOSITORY}/manifests/${reference}`, {
    Authorization: `Bearer ${token}`,
    Accept: MANIFEST_ACCEPT,
  });
}

async function resolveBottle(version: string, arch: string): Promise<{ digest: string; token: string }> {
  const token = await getRegistryToken();
  const index = await getManifest<OciIndex>(version, token);
  const ociArch = architectureForOci(arch);
  const platformManifest = index.manifests.find(
    candidate => candidate.platform?.os === 'linux' && candidate.platform.architecture === ociArch,
  );
  if (!platformManifest) {
    throw new Error(`no e2fsprogs bottle for linux/${arch}`);
  }
  const manifest = await getManifest<OciManifest>(platformManifest.digest, token);
  const bottle = manifest.layers.find(candidate => {
    const title = candidate.annotations?.['org.opencontainers.image.title'];
    return candidate.mediaType.endsWith('+gzip') && title?.endsWith('.bottle.tar.gz');
  });
  if (!bottle) {
    throw new Error('e2fsprogs OCI manifest does not contain a Homebrew bottle layer');
  }
  return { digest: bottle.digest, token };
}

async function downloadBottle(digest: string, token: string, destination: string): Promise<void> {
  const url = `${REGISTRY}/v2/${REPOSITORY}/blobs/${digest}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',
    signal: AbortSignal.timeout(BOTTLE_DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok || !response.body) {
    throw new Error(`failed to download e2fsprogs bottle: ${response.status} ${response.statusText}`);
  }
  await pipeline(response.body, createWriteStream(destination));
}

function loaderForArchitecture(arch: string): string {
  if (arch === 'x64') return '/lib64/ld-linux-x86-64.so.2';
  if (arch === 'arm64') return '/lib/ld-linux-aarch64.so.1';
  throw new Error(`unsupported e2fsprogs architecture: ${arch}`);
}

function wrapper(binaryName: string, payload: string, arch: string): string {
  const loader = loaderForArchitecture(arch);
  return `#!/bin/sh
set -eu
bin_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
runtime_dir="$bin_dir/${RUNTIME_DIRECTORY}"
loader="${loader}"
if [ ! -x "$loader" ]; then
  echo "${binaryName} requires the glibc loader at $loader" >&2
  exit 127
fi
export LD_LIBRARY_PATH="$runtime_dir/lib\${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export MKE2FS_CONFIG="\${MKE2FS_CONFIG:-$runtime_dir/mke2fs.conf}"
exec "$loader" --argv0 "${binaryName}" "$runtime_dir/${payload}" "$@"
`;
}

async function stageBottle(archive: string, version: string, arch: string, outputDir: string): Promise<void> {
  const extractionDir = await mkdtemp(join(tmpdir(), 'kaiden-e2fsprogs-'));
  try {
    await tar.extract({
      file: archive,
      cwd: extractionDir,
      filter: (path, entry) => 'type' in entry && isRequiredBottleEntry(path, entry.type, version),
    });
    const bottleRoot = join(extractionDir, 'e2fsprogs', version);
    const runtimeDir = join(outputDir, RUNTIME_DIRECTORY);
    const libDir = join(runtimeDir, 'lib');
    await rm(runtimeDir, { recursive: true, force: true });
    await mkdir(libDir, { recursive: true });

    for (const binary of BINARIES) {
      const payload = join(runtimeDir, binary.payload);
      await copyFile(join(bottleRoot, 'sbin', binary.payload), payload);
      await chmod(payload, 0o755);
    }
    const bottleLibraries = await readdir(join(bottleRoot, 'lib'));
    for (const library of LIBRARIES) {
      const source = bottleLibraries.find(candidate => candidate.startsWith(`${library}.`));
      if (!source) {
        throw new Error(`e2fsprogs bottle does not contain ${library}`);
      }
      await copyFile(join(bottleRoot, 'lib', source), join(libDir, library));
    }
    await copyFile(join(bottleRoot, '.bottle', 'etc', 'mke2fs.conf'), join(runtimeDir, 'mke2fs.conf'));
    await copyFile(join(bottleRoot, 'NOTICE'), join(runtimeDir, 'NOTICE'));

    for (const binary of BINARIES) {
      const destination = join(outputDir, binary.name);
      await writeFile(destination, wrapper(binary.name, binary.payload, arch), { encoding: 'utf-8' });
      await chmod(destination, 0o755);
    }
  } finally {
    await rm(extractionDir, { recursive: true, force: true });
  }
}

function hasCompleteInstallation(outputDir: string): boolean {
  return [
    ...BINARIES.map(binary => join(outputDir, binary.name)),
    ...BINARIES.map(binary => join(outputDir, RUNTIME_DIRECTORY, binary.payload)),
    ...LIBRARIES.map(library => join(outputDir, RUNTIME_DIRECTORY, 'lib', library)),
    join(outputDir, RUNTIME_DIRECTORY, 'mke2fs.conf'),
    join(outputDir, RUNTIME_DIRECTORY, 'NOTICE'),
  ].every(path => existsSync(path));
}

export async function downloadMkfsExt4(version: string, arch: string, outputDir: string): Promise<void> {
  architectureForOci(arch);

  const versionFile = join(outputDir, '.mkfs-ext4-version');
  const versionMarker = `${version}-linux-${arch}`;
  if (existsSync(versionFile) && hasCompleteInstallation(outputDir)) {
    const existing = await readFile(versionFile, 'utf-8');
    if (existing.trim() === versionMarker) {
      console.log(`mkfs.ext4 ${version} for linux/${arch} already downloaded`);
      return;
    }
  }

  const { digest, token } = await resolveBottle(version, arch);
  const expectedDigest = digest.replace(/^sha256:/, '');
  if (!/^[a-f0-9]{64}$/i.test(expectedDigest)) {
    throw new Error(`invalid e2fsprogs bottle digest: ${digest}`);
  }

  await mkdir(outputDir, { recursive: true });
  const archive = join(outputDir, `${expectedDigest}.bottle.tar.gz`);
  try {
    console.log(`downloading mkfs.ext4 ${version} for linux/${arch}...`);
    await downloadBottle(digest, token, archive);
    const actualDigest = await sha256(archive);
    if (actualDigest !== expectedDigest) {
      throw new Error(`checksum mismatch for e2fsprogs bottle: expected ${expectedDigest}, got ${actualDigest}`);
    }
    console.log('checksum verified for e2fsprogs bottle');
    await stageBottle(archive, version, arch, outputDir);
    await writeFile(versionFile, versionMarker, { encoding: 'utf-8' });
  } catch (error) {
    await Promise.all([
      rm(join(outputDir, 'mkfs.ext4'), { force: true }),
      rm(join(outputDir, 'debugfs'), { force: true }),
      rm(join(outputDir, RUNTIME_DIRECTORY), { recursive: true, force: true }),
      rm(versionFile, { force: true }),
    ]);
    throw error;
  } finally {
    await rm(archive, { force: true });
  }
  console.log(`mkfs.ext4 ${version} for linux/${arch} ready`);
}
