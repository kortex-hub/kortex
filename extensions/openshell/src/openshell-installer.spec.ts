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
 **********************************************************************/

import { join } from 'node:path';

import type { CliTool, Logger } from '@openkaiden/api';
import { env } from '@openkaiden/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  downloadBinaries,
  getRelease,
  OPENSHELL_DOWNLOAD,
  OPENSHELL_IMAGE_BUILDER_DOWNLOAD,
} from './openshell-download';
import { OpenshellImageBuilderInstaller } from './openshell-image-builder-installer';
import { OpenshellInstaller } from './openshell-installer';

vi.mock(import('./openshell-download'));

const logger: Logger = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

const cliTool: CliTool = {
  updateVersion: vi.fn(),
} as unknown as CliTool;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getRelease).mockResolvedValue({
    version: '0.0.55',
    digests: new Map([['openshell-x86_64-unknown-linux-musl.tar.gz', 'abc123']]),
  });
  vi.mocked(downloadBinaries).mockResolvedValue();
});

describe('OpenshellInstaller', () => {
  describe('selectVersion', () => {
    test('returns pinned version from release', async () => {
      const installer = new OpenshellInstaller(cliTool, '0.0.55', '/tmp/storage');

      const version = await installer.selectVersion();

      expect(version).toBe('0.0.55');
      expect(getRelease).toHaveBeenCalledWith(OPENSHELL_DOWNLOAD, '0.0.55');
    });

    test('caches version on subsequent calls', async () => {
      const installer = new OpenshellInstaller(cliTool, '0.0.55', '/tmp/storage');

      await installer.selectVersion();
      await installer.selectVersion();

      expect(getRelease).toHaveBeenCalledTimes(1);
    });

    test('re-fetches when latest is true', async () => {
      const installer = new OpenshellInstaller(cliTool, '0.0.55', '/tmp/storage');

      await installer.selectVersion();
      await installer.selectVersion(true);

      expect(getRelease).toHaveBeenCalledTimes(2);
    });
  });

  describe('doInstall', () => {
    test('downloads binaries for linux', async () => {
      vi.mocked(env).isMac = false;
      vi.mocked(env).isLinux = true;

      const installer = new OpenshellInstaller(cliTool, '0.0.55', '/tmp/storage');
      await installer.doInstall(logger);

      expect(getRelease).toHaveBeenCalledWith(OPENSHELL_DOWNLOAD, '0.0.55');
      expect(downloadBinaries).toHaveBeenCalledWith(
        OPENSHELL_DOWNLOAD,
        '0.0.55',
        'linux',
        expect.any(String),
        join('/tmp/storage', 'bin'),
        expect.any(Map),
      );
      expect(logger.log).toHaveBeenCalledWith('OpenShell installation completed successfully');
      expect(cliTool.updateVersion).toHaveBeenCalledWith({
        version: '0.0.55',
        path: join('/tmp/storage', 'bin', 'openshell'),
      });
    });

    test('downloads binaries for mac', async () => {
      vi.mocked(env).isMac = true;
      vi.mocked(env).isLinux = false;

      const installer = new OpenshellInstaller(cliTool, '0.0.55', '/tmp/storage');
      await installer.doInstall(logger);

      expect(downloadBinaries).toHaveBeenCalledWith(
        OPENSHELL_DOWNLOAD,
        '0.0.55',
        'darwin',
        expect.any(String),
        join('/tmp/storage', 'bin'),
        expect.any(Map),
      );
      expect(cliTool.updateVersion).toHaveBeenCalledWith({
        version: '0.0.55',
        path: join('/tmp/storage', 'bin', 'openshell'),
      });
    });

    test('uses selected version when available', async () => {
      vi.mocked(env).isMac = false;
      vi.mocked(env).isLinux = true;

      const installer = new OpenshellInstaller(cliTool, '0.0.55', '/tmp/storage');
      await installer.selectVersion();
      await installer.doInstall(logger);

      expect(getRelease).toHaveBeenCalledTimes(2);
    });

    test('throws on unsupported platform', async () => {
      vi.mocked(env).isMac = false;
      vi.mocked(env).isLinux = false;

      const installer = new OpenshellInstaller(cliTool, '0.0.55', '/tmp/storage');
      await expect(installer.doInstall(logger)).rejects.toThrow('not supported on this platform');
    });

    test('logs error and rethrows on download failure', async () => {
      vi.mocked(env).isMac = false;
      vi.mocked(env).isLinux = true;
      vi.mocked(downloadBinaries).mockRejectedValue(new Error('network error'));

      const installer = new OpenshellInstaller(cliTool, '0.0.55', '/tmp/storage');
      await expect(installer.doInstall(logger)).rejects.toThrow('network error');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('network error'));
    });
  });
});

describe('OpenshellImageBuilderInstaller', () => {
  beforeEach(() => {
    vi.mocked(getRelease).mockResolvedValue({
      version: '0.9.0',
      digests: new Map([['openshell-image-builder-x86_64-unknown-linux-gnu', 'abc123']]),
    });
  });

  test('uses the image builder repository when selecting a version', async () => {
    const installer = new OpenshellImageBuilderInstaller(cliTool, '0.9.0', '/tmp/storage');

    const version = await installer.selectVersion();

    expect(version).toBe('0.9.0');
    expect(getRelease).toHaveBeenCalledWith(OPENSHELL_IMAGE_BUILDER_DOWNLOAD, '0.9.0');
  });

  test('uses the shared downloader to install the image builder', async () => {
    vi.mocked(env).isMac = false;
    vi.mocked(env).isLinux = true;

    const installer = new OpenshellImageBuilderInstaller(cliTool, '0.9.0', '/tmp/storage');
    await installer.doInstall(logger);

    expect(downloadBinaries).toHaveBeenCalledWith(
      OPENSHELL_IMAGE_BUILDER_DOWNLOAD,
      '0.9.0',
      'linux',
      expect.any(String),
      join('/tmp/storage', 'bin'),
      expect.any(Map),
    );
    expect(cliTool.updateVersion).toHaveBeenCalledWith({
      version: '0.9.0',
      path: join('/tmp/storage', 'bin', 'openshell-image-builder'),
    });
  });
});
