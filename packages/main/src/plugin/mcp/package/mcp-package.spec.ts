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
import { NPMSpawner } from './npm-spawner.js';
import { PyPiSpawner } from './pypi-spawner.js';

// Mock the spawner classes
vi.mock('./npm-spawner.js', () => ({
  NPMSpawner: vi.fn().mockImplementation(() => ({
    spawn: vi.fn(),
    asyncDispose: vi.fn(),
  })),
}));

vi.mock('./pypi-spawner.js', () => ({
  PyPiSpawner: vi.fn().mockImplementation(() => ({
    spawn: vi.fn(),
    asyncDispose: vi.fn(),
  })),
}));

describe('MCPPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should create NPMSpawner for npm registry type', () => {
    const pack = {
      identifier: 'test-package',
      version: '1.0.0',
      registryType: 'npm' as const,
    };

    const mcpPackage = new MCPPackage(pack);

    expect(mcpPackage).toBeDefined();
    expect(NPMSpawner).toHaveBeenCalledWith(pack);
    expect(PyPiSpawner).not.toHaveBeenCalled();
  });

  test('should create PyPiSpawner for pypi registry type', () => {
    const pack = {
      identifier: 'test-package',
      version: '1.0.0',
      registryType: 'pypi' as const,
    };

    const mcpPackage = new MCPPackage(pack);

    expect(mcpPackage).toBeDefined();
    expect(PyPiSpawner).toHaveBeenCalledWith(pack);
    expect(NPMSpawner).not.toHaveBeenCalled();
  });

  test('should throw error for unsupported registry type', () => {
    const pack = {
      identifier: 'test-package',
      version: '1.0.0',
      registryType: 'unsupported' as unknown as 'npm',
    };

    expect(() => new MCPPackage(pack)).toThrow('unsupported registry type: unsupported');
  });
});
