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

import { describe, expect, test, vi } from 'vitest';

import type { MCPSpawnerFactory } from './mcp-spawner-factory.js';
import { MCPSpawnerFactoryRegistry, mcpSpawnerFactoryRegistry } from './mcp-spawner-factory-registry.js';

describe('MCPSpawnerFactoryRegistry', () => {
  test('should register and retrieve a factory by registry type', () => {
    const registry = new MCPSpawnerFactoryRegistry();
    const factory: MCPSpawnerFactory = {
      command: 'test-cmd',
      getWorkspaceRequirements: vi.fn(),
      create: vi.fn(),
    };

    registry.register('test', factory);

    expect(registry.get('test')).toBe(factory);
  });

  test('should return undefined for unknown registry type', () => {
    const registry = new MCPSpawnerFactoryRegistry();

    expect(registry.get('unknown')).toBeUndefined();
  });

  test('should retrieve a factory by command', () => {
    const registry = new MCPSpawnerFactoryRegistry();
    const factory: MCPSpawnerFactory = {
      command: 'my-cmd',
      getWorkspaceRequirements: vi.fn(),
      create: vi.fn(),
    };

    registry.register('custom', factory);

    expect(registry.getByCommand('my-cmd')).toBe(factory);
  });

  test('should return undefined for unknown command', () => {
    const registry = new MCPSpawnerFactoryRegistry();

    expect(registry.getByCommand('no-such-cmd')).toBeUndefined();
  });

  test('should overwrite factory when registering same type twice', () => {
    const registry = new MCPSpawnerFactoryRegistry();
    const first: MCPSpawnerFactory = { command: 'a', getWorkspaceRequirements: vi.fn(), create: vi.fn() };
    const second: MCPSpawnerFactory = { command: 'b', getWorkspaceRequirements: vi.fn(), create: vi.fn() };

    registry.register('type', first);
    registry.register('type', second);

    expect(registry.get('type')).toBe(second);
  });
});

describe('mcpSpawnerFactoryRegistry singleton', () => {
  test('should have npm factory pre-registered', () => {
    const factory = mcpSpawnerFactoryRegistry.get('npm');

    expect(factory).toBeDefined();
    expect(factory!.command).toBe('npx');
  });

  test('should have pypi factory pre-registered', () => {
    const factory = mcpSpawnerFactoryRegistry.get('pypi');

    expect(factory).toBeDefined();
    expect(factory!.command).toBe('uvx');
  });

  test('should find npm factory by command npx', () => {
    const factory = mcpSpawnerFactoryRegistry.getByCommand('npx');

    expect(factory).toBeDefined();
    expect(factory!.command).toBe('npx');
  });

  test('should find pypi factory by command uvx', () => {
    const factory = mcpSpawnerFactoryRegistry.getByCommand('uvx');

    expect(factory).toBeDefined();
    expect(factory!.command).toBe('uvx');
  });
});
