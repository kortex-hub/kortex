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
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as tar from 'tar';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { downloadE2fsprogs, selectBottleLayer, selectE2fsprogsManifest } from './e2fsprogs-download';

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
    ...LIBRARIES.map(library => writeFile(join(bottleRoot, 'lib', library), library)),
  ]);

  const archive = join(testDir, 'bottle.tar.gz');
  await tar.create({ file: archive, gzip: true, cwd: join(testDir, 'fixture') }, ['e2fsprogs']);
  return readFile(archive);
}

function stubRegistry(bottle: Buffer): ReturnType<typeof vi.fn> {
  const digest = createHash('sha256').update(bottle).digest('hex');
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
            platform: { os: 'linux', architecture: 'amd64' },
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
            annotations: { 'org.opencontainers.image.title': `e2fsprogs--${VERSION}.x86_64_linux.bottle.tar.gz` },
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

describe('OCI selection', () => {
  test('selects the Linux bottle matching the requested Node architecture', () => {
    const selected = selectE2fsprogsManifest(
      {
        manifests: [
          { mediaType: 'manifest', digest: 'darwin', platform: { os: 'darwin', architecture: 'amd64' } },
          { mediaType: 'manifest', digest: 'linux-arm64', platform: { os: 'linux', architecture: 'arm64' } },
          { mediaType: 'manifest', digest: 'linux-amd64', platform: { os: 'linux', architecture: 'amd64' } },
        ],
      },
      'linux',
      'x64',
    );

    expect(selected.digest).toBe('linux-amd64');
  });

  test('selects the Homebrew bottle layer instead of unrelated layers', () => {
    const selected = selectBottleLayer({
      layers: [
        { mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', digest: 'other' },
        {
          mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip',
          digest: 'bottle',
          annotations: { 'org.opencontainers.image.title': 'e2fsprogs.bottle.tar.gz' },
        },
      ],
    });

    expect(selected.digest).toBe('bottle');
  });
});

test.runIf(process.platform === 'linux')('downloads, verifies, and stages executable e2fsprogs tools', async () => {
  const bottle = await createBottle();
  const fetchMock = stubRegistry(bottle);
  const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
  const outputDir = join(testDir, 'output');

  await downloadE2fsprogs(VERSION, 'linux', 'x64', outputDir);

  expect(await readFile(join(outputDir, 'libexec', 'mke2fs'), 'utf-8')).toBe('mke2fs-binary');
  expect(await readFile(join(outputDir, 'lib', 'libext2fs.so.2'), 'utf-8')).toBe('libext2fs.so.2');
  expect(await readFile(join(outputDir, '.e2fsprogs-version'), 'utf-8')).toBe(`${VERSION}-linux-x64`);
  expect(await readFile(join(outputDir, 'share', 'e2fsprogs', 'NOTICE'), 'utf-8')).toBe('license notice');
  expect((await stat(join(outputDir, 'bin', 'mkfs.ext4'))).mode & 0o111).not.toBe(0);
  expect(await readFile(join(outputDir, 'bin', 'mkfs.ext4'), 'utf-8')).toContain('--argv0 mkfs.ext4');
  expect(timeoutSpy.mock.calls).toEqual([[30_000], [30_000], [30_000], [5 * 60_000]]);

  const callsAfterDownload = fetchMock.mock.calls.length;
  await downloadE2fsprogs(VERSION, 'linux', 'x64', outputDir);
  expect(fetchMock).toHaveBeenCalledTimes(callsAfterDownload);
});

test('reports registry failures with the failing endpoint', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('', { status: 503, statusText: 'Service Unavailable' })),
  );

  await expect(downloadE2fsprogs(VERSION, 'linux', 'x64', join(testDir, 'output'))).rejects.toThrow(
    'failed to fetch https://ghcr.io/token',
  );
});
