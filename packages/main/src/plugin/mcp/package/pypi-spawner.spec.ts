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

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { PyPiSpawner } from './pypi-spawner.js';

vi.mock(import('node:fs/promises'));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('PyPiSpawner', () => {
  test('command is uvx', () => {
    expect(PyPiSpawner.command).toBe('uvx');
  });

  describe('getWorkspaceRequirements', () => {
    test('returns pypi hosts', () => {
      const reqs = PyPiSpawner.getWorkspaceRequirements();
      expect(reqs.hosts).toEqual(['pypi.org', 'files.pythonhosted.org']);
    });

    test('returns uv-feature', () => {
      const reqs = PyPiSpawner.getWorkspaceRequirements();
      expect(reqs.features).toEqual({ './uv-feature': {} });
    });

    test('returns UV_SYSTEM_CERTS env', () => {
      const reqs = PyPiSpawner.getWorkspaceRequirements();
      expect(reqs.env).toEqual({ UV_SYSTEM_CERTS: '1' });
    });

    test('provides ensureFeatures callback', () => {
      const reqs = PyPiSpawner.getWorkspaceRequirements();
      expect(reqs.ensureFeatures).toBeDefined();
    });

    test('ensureFeatures creates uv-feature directory and writes correct files', async () => {
      const reqs = PyPiSpawner.getWorkspaceRequirements();
      await reqs.ensureFeatures!('/config');

      expect(mkdir).toHaveBeenCalledWith(join('/config', 'uv-feature'), { recursive: true });
      expect(writeFile).toHaveBeenCalledWith(
        join('/config', 'uv-feature', 'devcontainer-feature.json'),
        JSON.stringify({ id: 'uv', version: '0.1.0', name: 'uv Python package manager' }, undefined, 2) + '\n',
        'utf-8',
      );
      expect(writeFile).toHaveBeenCalledWith(
        join('/config', 'uv-feature', 'install.sh'),
        '#!/bin/sh\npip install uv\n',
        { encoding: 'utf-8', mode: 0o755 },
      );
    });
  });

  describe('buildCommandSpec', () => {
    test('uses uvx command with identifier==version', () => {
      const spawner = new PyPiSpawner({
        identifier: 'mcp-server-example',
        version: '2.0.0',
        registryType: 'pypi',
        transport: { type: 'stdio' as const },
      });

      const spec = spawner.buildCommandSpec();

      expect(spec.command).toBe('uvx');
      expect(spec.args).toEqual(['mcp-server-example==2.0.0']);
    });

    test('uses identifier without version when version is not specified', () => {
      const spawner = new PyPiSpawner({
        identifier: 'mcp-server-example',
        registryType: 'pypi',
        transport: { type: 'stdio' as const },
      });

      const spec = spawner.buildCommandSpec();

      expect(spec.args).toEqual(['mcp-server-example']);
    });

    test('prepends runtimeArguments and appends packageArguments', () => {
      const spawner = new PyPiSpawner({
        identifier: 'mcp-server-example',
        version: '1.5.0',
        registryType: 'pypi',
        transport: { type: 'stdio' as const },
        runtimeArguments: ['--python', '3.11'],
        packageArguments: ['--host', '0.0.0.0'],
      });

      const spec = spawner.buildCommandSpec();

      expect(spec.args).toEqual(['--python', '3.11', 'mcp-server-example==1.5.0', '--host', '0.0.0.0']);
    });

    test('includes environment variables', () => {
      const spawner = new PyPiSpawner({
        identifier: 'mcp-server-example',
        version: '1.0.0',
        registryType: 'pypi',
        transport: { type: 'stdio' as const },
        environmentVariables: { API_KEY: 'test-key', SECRET: 'val' },
      });

      const spec = spawner.buildCommandSpec();

      expect(spec.env).toEqual({ API_KEY: 'test-key', SECRET: 'val' });
    });

    test('env is undefined when no environment variables are set', () => {
      const spawner = new PyPiSpawner({
        identifier: 'mcp-server-example',
        version: '1.0.0',
        registryType: 'pypi',
        transport: { type: 'stdio' as const },
      });

      const spec = spawner.buildCommandSpec();

      expect(spec.env).toBeUndefined();
    });

    test('throws when identifier is missing', () => {
      const spawner = new PyPiSpawner({
        identifier: '',
        version: '1.0.0',
        registryType: 'pypi',
        transport: { type: 'stdio' as const },
      });

      expect(() => spawner.buildCommandSpec()).toThrow('missing identifier in MCP Local Server configuration');
    });
  });
});
