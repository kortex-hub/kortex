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

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { MCPSchemaValidator } from './mcp-schema-validator.js';

const originalConsoleWarn = console.warn;

let validator: MCPSchemaValidator;

beforeEach(() => {
  vi.resetAllMocks();
  validator = new MCPSchemaValidator();
  console.warn = vi.fn();
});

afterEach(() => {
  console.warn = originalConsoleWarn;
});

describe('validateSchemaData', () => {
  test('should validate valid ServerList data', () => {
    const validServerList = {
      servers: [
        {
          server: {
            name: 'io.github.example/test-server',
            description: 'Test server',
            version: '1.0.0',
          },
          _meta: {},
        },
      ],
    };

    const result = validator.validateSchemaData(validServerList, 'ServerList', 'test-registry');

    expect(result).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('should warn on invalid ServerList missing required fields', () => {
    const invalidServerList = {
      servers: [
        {
          server: {
            name: 'io.github.example/test-server',
            description: 'Test',
            version: '1.0.0',
          },
        },
      ],
    };

    const result = validator.validateSchemaData(invalidServerList, 'ServerList', 'test-registry');

    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[MCPSchemaValidator] Failed to validate data against schema'),
      invalidServerList,
      'errors:',
      expect.anything(),
    );
  });

  test('should warn on ServerResponse missing _meta field', () => {
    const invalidServerResponse = {
      server: {
        name: 'io.github.example/test-server',
        description: 'Test',
        version: '1.0.0',
      },
    };

    const result = validator.validateSchemaData(invalidServerResponse, 'ServerResponse', 'test-registry');

    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[MCPSchemaValidator] Failed to validate data against schema'),
      invalidServerResponse,
      'errors:',
      expect.anything(),
    );
  });

  test('should fail when server.description is missing even with tolerable errors present', () => {
    const serverResponse = {
      server: {
        name: 'com.github.mcp',
        version: '1.0.0',
        packages: [{ registryType: 'npm', identifier: 'x', transport: { type: 'stdio' } }],
      },
      _meta: {},
    };

    const result = validator.validateSchemaData(serverResponse, 'ServerResponse', 'test-registry');

    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  test('should reject ServerResponse when server name fails bundled reverse-DNS pattern', () => {
    const serverResponse = {
      server: {
        name: 'com.github.mcp',
        description: 'Test',
        version: '1.0.0',
      },
      _meta: {},
    };

    const result = validator.validateSchemaData(serverResponse, 'ServerResponse', 'test-registry');

    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  test('should reject ServerResponse with non-conforming remotes type', () => {
    const serverResponse = {
      server: {
        name: 'io.github.example/test-server',
        description: 'Test',
        version: '1.0.0',
        remotes: [{ type: 'invalid-type', url: 'https://example.com' }],
      },
      _meta: {},
    };

    const result = validator.validateSchemaData(serverResponse, 'ServerResponse', 'test-registry');

    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  test('should tolerate errors under /server/packages path (schema drift)', () => {
    const serverResponse = {
      server: {
        name: 'io.github.example/test-server',
        description: 'Test',
        version: '1.0.0',
        packages: [
          {
            registryType: 'npm',
            identifier: '@scope/pkg',
            transport: { type: 'stdio' },
            packageArguments: [{ type: 'future-type', name: 'arg1' }],
          },
        ],
      },
      _meta: {},
    };

    const result = validator.validateSchemaData(serverResponse, 'ServerResponse', 'test-registry');

    expect(result).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('should validate valid ServerResponse with remotes', () => {
    const validServerResponse = {
      server: {
        name: 'io.github.example/test-server',
        description: 'Test server',
        version: '1.0.0',
        remotes: [
          {
            type: 'streamable-http',
            url: 'https://example.com/mcp',
          },
        ],
      },
      _meta: {},
    };

    const result = validator.validateSchemaData(validServerResponse, 'ServerResponse', 'test-registry');

    expect(result).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('should tolerate unknown _meta fields from official registry (e.g. statusChangedAt)', () => {
    const serverResponse = {
      server: {
        name: 'zone.example/registry-test',
        description: 'Test',
        version: '1.0.0',
      },
      _meta: {
        'io.modelcontextprotocol.registry/official': {
          status: 'active',
          statusChangedAt: '2026-03-13T03:50:03.628037Z',
          publishedAt: '2026-03-13T03:50:03.628037Z',
          updatedAt: '2026-03-13T03:50:03.628037Z',
          isLatest: true,
        },
      },
    };

    const result = validator.validateSchemaData(
      serverResponse,
      'ServerResponse',
      'https://registry.modelcontextprotocol.io',
    );

    expect(result).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('should tolerate repository as an empty object (registry placeholder)', () => {
    const serverResponse = {
      server: {
        name: 'io.github.example/scrimba-teaching',
        description: 'Teaching',
        version: '2.0.0',
        repository: {},
      },
      _meta: {},
    };

    const result = validator.validateSchemaData(
      serverResponse,
      'ServerResponse',
      'https://registry.modelcontextprotocol.io',
    );

    expect(result).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('should validate valid ServerDetail', () => {
    const validServerDetail = {
      name: 'io.github.example/test-server',
      description: 'A test MCP server',
      version: '1.0.0',
    };

    const result = validator.validateSchemaData(validServerDetail, 'ServerDetail');

    expect(result).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('should warn when ServerDetail is missing required fields', () => {
    const invalidServerDetail = {
      name: 'io.github.example/test-server',
    };

    const result = validator.validateSchemaData(invalidServerDetail, 'ServerDetail');

    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[MCPSchemaValidator] Failed to validate data against schema'),
      invalidServerDetail,
      'errors:',
      expect.anything(),
    );
  });

  test('should include context name in warning message when provided', () => {
    const invalidData = {
      servers: [
        {
          server: {
            name: 'test-server',
            description: 'test',
            version: '1.0.0',
          },
        },
      ],
    };

    validator.validateSchemaData(invalidData, 'ServerList', 'https://example-registry.com');

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(`from 'https://example-registry.com'`),
      invalidData,
      'errors:',
      expect.anything(),
    );
  });

  test('should not include context in warning when contextName is not provided', () => {
    const invalidData = {
      servers: [
        {
          server: {
            name: 'test',
            description: 'test',
            version: '1.0.0',
          },
        },
      ],
    };

    validator.validateSchemaData(invalidData, 'ServerList');

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[MCPSchemaValidator] Failed to validate data against schema'),
      invalidData,
      'errors:',
      expect.anything(),
    );
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining(' from '), expect.anything());
  });

  test('should validate Repository schema', () => {
    const validRepository = {
      url: 'https://github.com/example/repo',
      source: 'github',
    };

    const result = validator.validateSchemaData(validRepository, 'Repository');

    expect(result).toBe(true);
  });

  test('should warn on invalid Repository missing required fields', () => {
    const invalidRepository = {
      url: 'https://github.com/example/repo',
    };

    const result = validator.validateSchemaData(invalidRepository, 'Repository');

    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  test('should not warn when suppressWarnings is true', () => {
    const invalidRepository = {
      url: 'https://github.com/example/repo',
    };

    const result = validator.validateSchemaData(invalidRepository, 'Repository', undefined, true);

    expect(result).toBe(false);
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('[MCPSchemaValidator] Failed to validate data against schema'),
      expect.anything(),
    );
  });
});

describe('validateSchemaData with individual ServerResponse validation', () => {
  test('should identify all invalid servers when validating each ServerResponse individually', () => {
    const servers = [
      {
        server: {
          name: 'io.github.example/invalid-server-1',
          description: 'Invalid server 1',
          version: '1.0.0',
        },
      },
      {
        server: {
          name: 'io.github.example/valid-server',
          description: 'Valid server',
          version: '1.0.0',
        },
        _meta: {},
      },
      {
        server: {
          name: 'io.github.example/invalid-server-2',
          description: 'Invalid server 2',
          version: '1.0.0',
        },
      },
    ];

    const invalidServerNames = new Set<string>();
    for (const serverResponse of servers) {
      const result = validator.validateSchemaData(serverResponse, 'ServerResponse', 'test-registry', true);
      if (!result) {
        invalidServerNames.add(serverResponse.server.name);
      }
    }

    expect(invalidServerNames.size).toBe(2);
    expect(invalidServerNames.has('io.github.example/invalid-server-1')).toBe(true);
    expect(invalidServerNames.has('io.github.example/invalid-server-2')).toBe(true);
    expect(invalidServerNames.has('io.github.example/valid-server')).toBe(false);
  });

  test('should reject ServerResponse when server name does not match pattern', () => {
    const serverResponse = {
      server: {
        name: 'invalid-name-no-slash',
        description: 'Invalid server',
        version: '1.0.0',
      },
      _meta: {},
    };

    const result = validator.validateSchemaData(serverResponse, 'ServerResponse', 'test-registry', true);

    expect(result).toBe(false);
  });

  test('should return valid for all valid servers', () => {
    const servers = [
      {
        server: {
          name: 'io.github.example/server-1',
          description: 'Server 1',
          version: '1.0.0',
        },
        _meta: {},
      },
      {
        server: {
          name: 'io.github.example/server-2',
          description: 'Server 2',
          version: '2.0.0',
        },
        _meta: {},
      },
    ];

    for (const serverResponse of servers) {
      const result = validator.validateSchemaData(serverResponse, 'ServerResponse', 'test-registry', true);
      expect(result).toBe(true);
    }
  });
});
