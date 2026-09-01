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

import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as tar from 'tar';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { downloadMkfsExt4 } from './e2fsprogs-download';

const VERSION = '1.47.4';
const LIBRARIES = ['libcom_err.so.2', 'libe2p.so.2', 'libext2fs.so.2', 'libss.so.2'];

let testDir: string;

beforeEach(async () => {
  vi.resetAllMocks();
  testDir = await mkdtemp(join(tmpdir(), 'e2fsprogs-download-test-'));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(testDir, { recursive: true, force: true });
});

async function createBottle(): Promise<Buffer> {
  const bottleRoot = join(testDir, 'fixture', 'e2fsprogs', VERSION);
  await Promise.all([
    mkdir(join(bottleRoot, 'sbin'), { recursive: true }),
    mkdir(join(bottleRoot, 'lib'), { recursive: true }),
    mkdir(join(bottleRoot, '.bottle', 'etc'), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(bottleRoot, 'sbin', 'mke2fs'), 'mke2fs-binary'),
    writeFile(join(bottleRoot, 'sbin', 'debugfs'), 'debugfs-binary'),
    writeFile(join(bottleRoot, '.bottle', 'etc', 'mke2fs.conf'), '[defaults]\n'),
    writeFile(join(bottleRoot, 'NOTICE'), 'license notice'),
    writeFile(join(bottleRoot, 'README'), 'readme'),
    writeFile(join(bottleRoot, 'sbom.spdx.json'), '{}'),
    ...LIBRARIES.map(library => writeFile(join(bottleRoot, 'lib', `${library}.1`), library)),
  ]);
  await Promise.all(LIBRARIES.map(library => symlink(`${library}.1`, join(bottleRoot, 'lib', library))));

  const archive = join(testDir, 'bottle.tar.gz');
  await tar.create({ file: archive, gzip: true, cwd: join(testDir, 'fixture') }, ['e2fsprogs']);
  return readFile(archive);
}

function stubRegistry(bottle: Buffer, architecture = 'amd64'): ReturnType<typeof vi.fn> {
  const digest = createHash('sha256').update(bottle).digest('hex');
  const bottleArchitecture = architecture === 'amd64' ? 'x86_64' : 'aarch64';
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/token?')) {
      return Response.json({ token: 'registry-token' });
    }
    if (url.endsWith(`/manifests/${VERSION}`)) {
      return Response.json({
        manifests: [
          {
            mediaType: 'application/vnd.oci.image.manifest.v1+json',
            digest: 'sha256:platform',
            platform: { os: 'linux', architecture },
          },
        ],
      });
    }
    if (url.endsWith('/manifests/sha256:platform')) {
      return Response.json({
        layers: [
          {
            mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip',
            digest: `sha256:${digest}`,
            annotations: {
              'org.opencontainers.image.title': `e2fsprogs--${VERSION}.${bottleArchitecture}_linux.bottle.tar.gz`,
            },
          },
        ],
      });
    }
    if (url.endsWith(`/blobs/sha256:${digest}`)) {
      return new Response(bottle);
    }
    return new Response('unexpected URL', { status: 404, statusText: 'Not Found' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

test('downloads and stages the e2fsprogs tools beside the VM driver', async () => {
  const bottle = await createBottle();
  const fetchMock = stubRegistry(bottle);
  const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
  const outputDir = join(testDir, 'output');
  await mkdir(outputDir);
  await writeFile(join(outputDir, 'openshell-driver-vm'), 'vm-driver');

  await downloadMkfsExt4(VERSION, 'x64', outputDir);

  expect(await readFile(join(outputDir, 'openshell-driver-vm'), 'utf-8')).toBe('vm-driver');
  expect(await readFile(join(outputDir, 'e2fsprogs', 'mke2fs'), 'utf-8')).toBe('mke2fs-binary');
  expect(await readFile(join(outputDir, 'e2fsprogs', 'debugfs'), 'utf-8')).toBe('debugfs-binary');
  expect(await readFile(join(outputDir, 'e2fsprogs', 'NOTICE'), 'utf-8')).toBe('license notice');
  for (const library of LIBRARIES) {
    expect(await readFile(join(outputDir, 'e2fsprogs', 'lib', library), 'utf-8')).toBe(library);
  }
  expect(await readFile(join(outputDir, 'e2fsprogs', 'mke2fs.conf'), 'utf-8')).toBe('[defaults]\n');
  expect(await readFile(join(outputDir, '.mkfs-ext4-version'), 'utf-8')).toBe(`${VERSION}-linux-x64`);
  if (process.platform !== 'win32') {
    expect((await stat(join(outputDir, 'mkfs.ext4'))).mode & 0o111).not.toBe(0);
    expect((await stat(join(outputDir, 'debugfs'))).mode & 0o111).not.toBe(0);
  }
  expect(await readFile(join(outputDir, 'mkfs.ext4'), 'utf-8')).toContain('--argv0 "mkfs.ext4"');
  expect(await readFile(join(outputDir, 'mkfs.ext4'), 'utf-8')).toContain('runtime_dir="$bin_dir/e2fsprogs"');
  expect(await readFile(join(outputDir, 'mkfs.ext4'), 'utf-8')).toContain(
    `export LD_LIBRARY_PATH="$runtime_dir/lib\${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"`,
  );
  expect(await readFile(join(outputDir, 'mkfs.ext4'), 'utf-8')).toContain(
    'mkfs.ext4 requires the glibc loader at $loader',
  );
  expect(await readFile(join(outputDir, 'debugfs'), 'utf-8')).toContain('--argv0 "debugfs"');
  expect(timeoutSpy.mock.calls).toEqual([[30_000], [30_000], [30_000], [5 * 60_000]]);

  const callsAfterDownload = fetchMock.mock.calls.length;
  await downloadMkfsExt4(VERSION, 'x64', outputDir);
  expect(fetchMock).toHaveBeenCalledTimes(callsAfterDownload);

  await chmod(join(outputDir, 'e2fsprogs', 'lib', 'libext2fs.so.2'), 0o444);
  await rm(join(outputDir, 'e2fsprogs', 'mke2fs'));
  await downloadMkfsExt4(VERSION, 'x64', outputDir);
  expect(await readFile(join(outputDir, 'e2fsprogs', 'mke2fs'), 'utf-8')).toBe('mke2fs-binary');
  expect(fetchMock).toHaveBeenCalledTimes(callsAfterDownload * 2);
});

test('uses the arm64 ELF loader in the launcher', async () => {
  const bottle = await createBottle();
  stubRegistry(bottle, 'arm64');
  const outputDir = join(testDir, 'output');

  await downloadMkfsExt4(VERSION, 'arm64', outputDir);

  expect(await readFile(join(outputDir, 'mkfs.ext4'), 'utf-8')).toContain('/lib/ld-linux-aarch64.so.1');
});

test('reports registry failures with the failing endpoint', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('', { status: 503, statusText: 'Service Unavailable' })),
  );

  await expect(downloadMkfsExt4(VERSION, 'x64', join(testDir, 'output'))).rejects.toThrow(
    'failed to fetch https://ghcr.io/token',
  );
});
