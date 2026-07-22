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

import type { PathLike } from 'node:fs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cli, configuration, process as extensionProcess } from '@openkaiden/api';
import { assert, beforeEach, describe, expect, test, vi } from 'vitest';

import { OpenshellCliManager } from './openshell-cli-manager';

vi.mock(import('node:fs'));
vi.mock(import('@openkaiden/api'));

const STORAGE_PATH = '/fake/storage';
const EXTENSION_URI = '/fake/extension';

function createManager(): OpenshellCliManager {
  const manager = new OpenshellCliManager();
  Object.defineProperty(manager, 'extensionContext', {
    value: {
      extensionUri: { fsPath: EXTENSION_URI },
      storagePath: STORAGE_PATH,
      subscriptions: [],
    },
    writable: false,
  });
  return manager;
}

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(readFileSync).mockReturnValue(
    JSON.stringify({ openshellVersion: '0.1.0', openshellImageBuilderVersion: '0.1.0' }),
  );

  vi.mocked(configuration.getConfiguration).mockReturnValue({
    get: vi.fn().mockReturnValue(undefined),
    has: vi.fn(),
    update: vi.fn(),
  } as never);

  vi.mocked(cli.createCliTool).mockReturnValue({
    registerInstaller: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    updateVersion: vi.fn(),
    dispose: vi.fn(),
  } as never);

  // default: no binary exists anywhere
  vi.mocked(existsSync).mockReturnValue(false);
});

describe('OpenshellCliManager', () => {
  test('registers gateway CLI tool even when binary is not found', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const manager = createManager();
    await manager.init();

    const createCalls = vi.mocked(cli.createCliTool).mock.calls;
    const registeredNames = createCalls.map(call => call[0].name);

    expect(registeredNames).toContain('openshell');
    expect(registeredNames).toContain('openshell-image-builder');
    expect(registeredNames).toContain('openshell-gateway');

    const gwCall = createCalls.find(call => call[0].name === 'openshell-gateway');
    assert(gwCall);
    expect(gwCall[0].installationSource).toBe('extension');
    expect(gwCall[0].path).toBeUndefined();
    expect(gwCall[0].version).toBeUndefined();
  });

  describe('binary discovery priority', () => {
    test('prefers bundled resource over system PATH', async () => {
      const platformArch = `${process.platform}-${process.arch}`;
      const bundledPath = join(EXTENSION_URI, 'assets', platformArch, 'openshell');

      vi.mocked(existsSync).mockImplementation((p: PathLike) => {
        return String(p) === bundledPath;
      });

      // bundled binary returns a version
      vi.mocked(extensionProcess.exec).mockImplementation(async (cmd: string) => {
        if (cmd === bundledPath) {
          return { stdout: 'openshell 0.2.0', stderr: '', command: cmd };
        }
        // system PATH binary would also work — but should not be reached
        if (cmd === 'openshell') {
          return { stdout: 'openshell 0.0.1', stderr: '', command: cmd };
        }
        throw new Error(`unexpected exec: ${cmd}`);
      });

      const manager = createManager();
      await manager.init();

      expect(manager.getRegisteredPath()).toBe(bundledPath);
      // system PATH lookup (bare `openshell`) must NOT have been called
      expect(extensionProcess.exec).not.toHaveBeenCalledWith('openshell', expect.anything());
      // only the bundled binary should have been version-checked
      expect(extensionProcess.exec).toHaveBeenCalledWith(bundledPath, ['--version']);
    });

    test('falls back to system PATH when no bundled resource exists', async () => {
      // no binary exists on disk
      vi.mocked(existsSync).mockReturnValue(false);

      // system PATH binary responds
      vi.mocked(extensionProcess.exec).mockImplementation(async (cmd: string, args?: string[]) => {
        if (cmd === 'openshell' && args?.[0] === '--version') {
          return { stdout: 'openshell 0.0.1', stderr: '', command: cmd };
        }
        if (cmd === 'which') {
          return { stdout: '/usr/local/bin/openshell\n', stderr: '', command: cmd };
        }
        throw new Error(`unexpected exec: ${cmd}`);
      });

      const manager = createManager();
      await manager.init();

      expect(manager.getRegisteredPath()).toBe('/usr/local/bin/openshell');
    });

    test('prefers extension storage over bundled resource when resolution is storage,bundled,system', async () => {
      const storageBinPath = join(STORAGE_PATH, 'bin', 'openshell');
      const platformArch = `${process.platform}-${process.arch}`;
      const bundledPath = join(EXTENSION_URI, 'assets', platformArch, 'openshell');

      vi.mocked(configuration.getConfiguration).mockReturnValue({
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'binary.resolution') return 'storage,bundled,system';
          return undefined;
        }),
        has: vi.fn(),
        update: vi.fn(),
      } as never);

      vi.mocked(existsSync).mockImplementation((p: PathLike) => {
        const s = String(p);
        return s === storageBinPath || s === bundledPath;
      });

      vi.mocked(extensionProcess.exec).mockImplementation(async (cmd: string) => {
        if (cmd === storageBinPath) {
          return { stdout: 'openshell 0.3.0', stderr: '', command: cmd };
        }
        if (cmd === bundledPath) {
          return { stdout: 'openshell 0.2.0', stderr: '', command: cmd };
        }
        throw new Error(`unexpected exec: ${cmd}`);
      });

      const manager = createManager();
      await manager.init();

      expect(manager.getRegisteredPath()).toBe(storageBinPath);
      // bundled binary should not have been checked
      expect(extensionProcess.exec).not.toHaveBeenCalledWith(bundledPath, expect.anything());
    });

    test('prefers system PATH over bundled resource when resolution is system,bundled,storage', async () => {
      const platformArch = `${process.platform}-${process.arch}`;
      const bundledPath = join(EXTENSION_URI, 'assets', platformArch, 'openshell');

      vi.mocked(configuration.getConfiguration).mockReturnValue({
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'binary.resolution') return 'system,bundled,storage';
          return undefined;
        }),
        has: vi.fn(),
        update: vi.fn(),
      } as never);

      vi.mocked(existsSync).mockImplementation((p: PathLike) => {
        return String(p) === bundledPath;
      });

      vi.mocked(extensionProcess.exec).mockImplementation(async (cmd: string, args?: string[]) => {
        if (cmd === 'openshell' && args?.[0] === '--version') {
          return { stdout: 'openshell 0.0.1', stderr: '', command: cmd };
        }
        if (cmd === 'which') {
          return { stdout: '/usr/local/bin/openshell\n', stderr: '', command: cmd };
        }
        throw new Error(`unexpected exec: ${cmd}`);
      });

      const manager = createManager();
      await manager.init();

      expect(manager.getRegisteredPath()).toBe('/usr/local/bin/openshell');
      // bundled binary should NOT have been version-checked because system PATH was found first
      expect(extensionProcess.exec).not.toHaveBeenCalledWith(bundledPath, expect.anything());
    });

    test('uses process.resourcesPath with original subdir in production mode', async () => {
      vi.stubEnv('PROD', true);
      const bundledPath = join('/resources', 'openshell', 'openshell');

      Object.defineProperty(process, 'resourcesPath', { value: '/resources', configurable: true });

      vi.mocked(existsSync).mockImplementation((p: PathLike) => {
        return String(p) === bundledPath;
      });

      vi.mocked(extensionProcess.exec).mockImplementation(async (cmd: string) => {
        if (cmd === bundledPath) {
          return { stdout: 'openshell 0.2.0', stderr: '', command: cmd };
        }
        throw new Error(`unexpected exec: ${cmd}`);
      });

      const manager = createManager();
      await manager.init();

      expect(manager.getRegisteredPath()).toBe(bundledPath);

      Object.defineProperty(process, 'resourcesPath', { value: undefined, configurable: true });
      vi.unstubAllEnvs();
    });

    test('uses assets folder with platform-arch subdir in development mode', async () => {
      const platformArch = `${process.platform}-${process.arch}`;
      const bundledPath = join(EXTENSION_URI, 'assets', platformArch, 'openshell');

      vi.mocked(existsSync).mockImplementation((p: PathLike) => {
        return String(p) === bundledPath;
      });

      vi.mocked(extensionProcess.exec).mockImplementation(async (cmd: string) => {
        if (cmd === bundledPath) {
          return { stdout: 'openshell 0.2.0', stderr: '', command: cmd };
        }
        throw new Error(`unexpected exec: ${cmd}`);
      });

      const manager = createManager();
      await manager.init();

      expect(manager.getRegisteredPath()).toBe(bundledPath);
      expect(extensionProcess.exec).toHaveBeenCalledWith(bundledPath, ['--version']);
    });

    test('uses assets/image-builder subdir for image builder in development mode', async () => {
      const platformArch = `${process.platform}-${process.arch}`;
      const ibBundledPath = join(EXTENSION_URI, 'assets', 'image-builder', platformArch, 'openshell-image-builder');

      vi.mocked(existsSync).mockImplementation((p: PathLike) => {
        return String(p) === ibBundledPath;
      });

      vi.mocked(extensionProcess.exec).mockImplementation(async (cmd: string) => {
        if (cmd === ibBundledPath) {
          return { stdout: 'openshell-image-builder 0.9.0', stderr: '', command: cmd };
        }
        throw new Error(`unexpected exec: ${cmd}`);
      });

      const manager = createManager();
      await manager.init();

      expect(extensionProcess.exec).toHaveBeenCalledWith(ibBundledPath, ['--version']);

      const createCalls = vi.mocked(cli.createCliTool).mock.calls;
      const ibCall = createCalls.find(call => call[0].name === 'openshell-image-builder');
      assert(ibCall);
      expect(ibCall[0].path).toBe(ibBundledPath);
      expect(ibCall[0].version).toBe('0.9.0');
    });

    test('prefers custom config path over all others', async () => {
      const customPath = '/custom/openshell';

      vi.mocked(configuration.getConfiguration).mockReturnValue({
        get: vi.fn().mockReturnValue(customPath),
        has: vi.fn(),
        update: vi.fn(),
      } as never);

      vi.mocked(existsSync).mockImplementation((p: PathLike) => {
        return String(p) === customPath;
      });

      vi.mocked(extensionProcess.exec).mockImplementation(async (cmd: string) => {
        if (cmd === customPath) {
          return { stdout: 'openshell 0.5.0', stderr: '', command: cmd };
        }
        throw new Error(`unexpected exec: ${cmd}`);
      });

      const manager = createManager();
      await manager.init();

      expect(manager.getRegisteredPath()).toBe(customPath);
    });
  });
});
