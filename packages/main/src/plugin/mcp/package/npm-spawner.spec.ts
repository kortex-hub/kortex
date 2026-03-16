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

import { describe, expect, test } from 'vitest';

import { NPMSpawner } from './npm-spawner.js';

describe('NPMSpawner', () => {
  describe('buildCommandSpec', () => {
    test('uses npx command with identifier@version', () => {
      const spawner = new NPMSpawner({
        identifier: '@example/mcp-server',
        version: '1.0.0',
        registryType: 'npm',
        transport: { type: 'stdio' as const },
      });

      const spec = spawner.buildCommandSpec();

      expect(spec.command).toBe('npx');
      expect(spec.args).toEqual(['@example/mcp-server@1.0.0']);
    });

    test('uses identifier without version when version is not specified', () => {
      const spawner = new NPMSpawner({
        identifier: '@example/mcp-server',
        registryType: 'npm',
        transport: { type: 'stdio' as const },
      });

      const spec = spawner.buildCommandSpec();

      expect(spec.args).toEqual(['@example/mcp-server']);
    });

    test('prepends runtimeArguments and appends packageArguments', () => {
      const spawner = new NPMSpawner({
        identifier: '@example/mcp-server',
        version: '2.0.0',
        registryType: 'npm',
        transport: { type: 'stdio' as const },
        runtimeArguments: ['--no-warnings'],
        packageArguments: ['--port', '3000'],
      });

      const spec = spawner.buildCommandSpec();

      expect(spec.args).toEqual(['--no-warnings', '@example/mcp-server@2.0.0', '--port', '3000']);
    });

    test('includes environment variables', () => {
      const spawner = new NPMSpawner({
        identifier: '@example/mcp-server',
        version: '1.0.0',
        registryType: 'npm',
        transport: { type: 'stdio' as const },
        environmentVariables: { API_KEY: 'test-key', SECRET: 'val' },
      });

      const spec = spawner.buildCommandSpec();

      expect(spec.env).toEqual({ API_KEY: 'test-key', SECRET: 'val' });
    });

    test('env is undefined when no environment variables are set', () => {
      const spawner = new NPMSpawner({
        identifier: '@example/mcp-server',
        version: '1.0.0',
        registryType: 'npm',
        transport: { type: 'stdio' as const },
      });

      const spec = spawner.buildCommandSpec();

      expect(spec.env).toBeUndefined();
    });

    test('throws when identifier is missing', () => {
      const spawner = new NPMSpawner({
        identifier: '',
        version: '1.0.0',
        registryType: 'npm',
        transport: { type: 'stdio' as const },
      });

      expect(() => spawner.buildCommandSpec()).toThrow('missing identifier in MCP Local Server configuration');
    });
  });
});
