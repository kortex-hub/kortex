/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { MCPPackage } from './mcp-package.js';
import type { ResolvedServerPackage } from './mcp-spawner.js';
import type { MCPSpawnerFactory } from './mcp-spawner-factory.js';
import { mcpSpawnerFactoryRegistry } from './mcp-spawner-factory-registry.js';

vi.mock(import('./mcp-spawner-factory-registry.js'));

describe('MCPPackage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should use factory from registry to create spawner', () => {
    const mockSpawner = {
      buildCommandSpec: vi.fn(),
      spawn: vi.fn(),
      asyncDispose: vi.fn(),
    };
    const mockFactory: MCPSpawnerFactory = {
      command: 'npx',
      getWorkspaceRequirements: vi.fn(),
      create: vi.fn().mockReturnValue(mockSpawner),
    };
    vi.mocked(mcpSpawnerFactoryRegistry.get).mockReturnValue(mockFactory);

    const pack = {
      identifier: 'test-package',
      version: '1.0.0',
      registryType: 'npm' as const,
      transport: { type: 'stdio' as const },
    };

    const mcpPackage = new MCPPackage(pack);

    expect(mcpPackage).toBeDefined();
    expect(mcpSpawnerFactoryRegistry.get).toHaveBeenCalledWith('npm');
    expect(mockFactory.create).toHaveBeenCalledWith(pack);
  });

  test('should delegate buildCommandSpec to spawner', () => {
    const mockSpec = { command: 'npx', args: ['test-package@1.0.0'] };
    const mockSpawner = {
      buildCommandSpec: vi.fn().mockReturnValue(mockSpec),
      spawn: vi.fn(),
      asyncDispose: vi.fn(),
    };
    const mockFactory: MCPSpawnerFactory = {
      command: 'npx',
      getWorkspaceRequirements: vi.fn(),
      create: vi.fn().mockReturnValue(mockSpawner),
    };
    vi.mocked(mcpSpawnerFactoryRegistry.get).mockReturnValue(mockFactory);

    const pack = {
      identifier: 'test-package',
      version: '1.0.0',
      registryType: 'npm' as const,
      transport: { type: 'stdio' as const },
    };

    const mcpPackage = new MCPPackage(pack);
    const result = mcpPackage.buildCommandSpec();

    expect(result).toBe(mockSpec);
  });

  test('should delegate spawn to spawner', async () => {
    const mockTransport = {};
    const mockSpawner = {
      buildCommandSpec: vi.fn(),
      spawn: vi.fn().mockResolvedValue(mockTransport),
      asyncDispose: vi.fn(),
    };
    const mockFactory: MCPSpawnerFactory = {
      command: 'uvx',
      getWorkspaceRequirements: vi.fn(),
      create: vi.fn().mockReturnValue(mockSpawner),
    };
    vi.mocked(mcpSpawnerFactoryRegistry.get).mockReturnValue(mockFactory);

    const pack = {
      identifier: 'test-package',
      version: '1.0.0',
      registryType: 'pypi' as const,
      transport: { type: 'stdio' as const },
    };

    const mcpPackage = new MCPPackage(pack);
    const result = await mcpPackage.spawn();

    expect(result).toBe(mockTransport);
  });

  test('should throw error when registry_type is missing', () => {
    const pack = {
      identifier: 'test-package',
      version: '1.0.0',
      transport: { type: 'stdio' as const },
    } as unknown as ResolvedServerPackage;

    expect(() => new MCPPackage(pack)).toThrow('cannot determine how to spawn package: registry_type is missing');
  });

  test('should throw error for unsupported registry type', () => {
    vi.mocked(mcpSpawnerFactoryRegistry.get).mockReturnValue(undefined);

    const pack = {
      identifier: 'test-package',
      version: '1.0.0',
      registryType: 'unsupported' as unknown as 'npm',
      transport: { type: 'stdio' as const },
    };

    expect(() => new MCPPackage(pack)).toThrow('unsupported registry type: unsupported');
  });
});
