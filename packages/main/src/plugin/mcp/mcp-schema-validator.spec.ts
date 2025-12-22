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

    expect(result.isValid).toBe(true);
    expect(result.invalidServerNames.size).toBe(0);
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
          // Missing _meta field
        },
      ],
    };

    const result = validator.validateSchemaData(invalidServerList, 'ServerList', 'test-registry');

    expect(result.isValid).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[MCPSchemaValidator] Failed to validate data against schema'),
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
      // Missing _meta field
    };

    const result = validator.validateSchemaData(invalidServerResponse, 'ServerResponse', 'test-registry');

    expect(result.isValid).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[MCPSchemaValidator] Failed to validate data against schema'),
      expect.anything(),
    );
  });

  test('should warn when server name does not match required pattern', () => {
    const invalidServerResponse = {
      server: {
        name: 'invalid-name-without-slash', // Should be in format "namespace/name"
        description: 'Test',
        version: '1.0.0',
      },
      _meta: {},
    };

    const result = validator.validateSchemaData(invalidServerResponse, 'ServerResponse', 'test-registry');

    expect(result.isValid).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[MCPSchemaValidator] Failed to validate data against schema'),
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('pattern'),
        }),
      ]),
    );
  });

  test('should warn when remote type is not a valid enum value', () => {
    const invalidServerResponse = {
      server: {
        name: 'io.github.example/test-server',
        description: 'Test',
        version: '1.0.0',
        remotes: [
          {
            type: 'invalid-type', // Should be 'sse' or 'streamable-http'
            url: 'https://example.com',
          },
        ],
      },
      _meta: {},
    };

    const result = validator.validateSchemaData(invalidServerResponse, 'ServerResponse', 'test-registry');

    expect(result.isValid).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[MCPSchemaValidator] Failed to validate data against schema'),
      expect.anything(),
    );
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

    expect(result.isValid).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('should validate valid ServerDetail', () => {
    const validServerDetail = {
      name: 'io.github.example/test-server',
      description: 'A test MCP server',
      version: '1.0.0',
    };

    const result = validator.validateSchemaData(validServerDetail, 'ServerDetail');

    expect(result.isValid).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('should warn when ServerDetail is missing required fields', () => {
    const invalidServerDetail = {
      name: 'io.github.example/test-server',
      // Missing description and version
    };

    const result = validator.validateSchemaData(invalidServerDetail, 'ServerDetail');

    expect(result.isValid).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[MCPSchemaValidator] Failed to validate data against schema'),
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
          // Missing required '_meta' field
        },
      ],
    };

    validator.validateSchemaData(invalidData, 'ServerList', 'https://example-registry.com');

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(`from 'https://example-registry.com'`),
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

    expect(result.isValid).toBe(true);
    // Note: AJV may warn about unknown formats like "uri", but validation still passes
  });

  test('should warn on invalid Repository missing required fields', () => {
    const invalidRepository = {
      url: 'https://github.com/example/repo',
      // Missing 'source' field
    };

    const result = validator.validateSchemaData(invalidRepository, 'Repository');

    expect(result.isValid).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  test('should not warn when suppressWarnings is true', () => {
    const invalidRepository = {
      url: 'https://github.com/example/repo',
      // Missing 'source' field
    };

    const result = validator.validateSchemaData(invalidRepository, 'Repository', undefined, true);

    expect(result.isValid).toBe(false);
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('[MCPSchemaValidator] Failed to validate data against schema'),
      expect.anything(),
    );
  });

  test('should return empty invalidServerNames for non-ServerList schemas', () => {
    const validServerDetail = {
      name: 'io.github.example/test-server',
      description: 'A test MCP server',
      version: '1.0.0',
    };

    const result = validator.validateSchemaData(validServerDetail, 'ServerDetail');

    expect(result.invalidServerNames.size).toBe(0);
  });
});

describe('validateSchemaData with ServerList invalid server extraction', () => {
  test('should return valid result for a valid ServerList', () => {
    const validServerList = {
      servers: [
        {
          server: {
            name: 'io.github.example/valid-server',
            description: 'Valid server',
            version: '1.0.0',
          },
          _meta: {},
        },
      ],
    };

    const result = validator.validateSchemaData(validServerList, 'ServerList', 'test-registry');

    expect(result.isValid).toBe(true);
    expect(result.invalidServerNames.size).toBe(0);
  });

  test('should identify invalid servers by name when _meta is missing', () => {
    const serverList = {
      servers: [
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
            name: 'io.github.example/invalid-server',
            description: 'Invalid server',
            version: '1.0.0',
          },
          // Missing _meta field
        },
      ],
    };

    const result = validator.validateSchemaData(serverList, 'ServerList', 'test-registry');

    expect(result.isValid).toBe(false);
    expect(result.invalidServerNames.size).toBe(1);
    expect(result.invalidServerNames.has('io.github.example/invalid-server')).toBe(true);
    expect(result.invalidServerNames.has('io.github.example/valid-server')).toBe(false);
  });

  test('should identify multiple invalid servers', () => {
    const serverList = {
      servers: [
        {
          server: {
            name: 'io.github.example/invalid-server-1',
            description: 'Invalid server 1',
            version: '1.0.0',
          },
          // Missing _meta
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
          // Missing _meta
        },
      ],
    };

    const result = validator.validateSchemaData(serverList, 'ServerList', 'test-registry');

    expect(result.isValid).toBe(false);
    expect(result.invalidServerNames.size).toBe(2);
    expect(result.invalidServerNames.has('io.github.example/invalid-server-1')).toBe(true);
    expect(result.invalidServerNames.has('io.github.example/invalid-server-2')).toBe(true);
    expect(result.invalidServerNames.has('io.github.example/valid-server')).toBe(false);
  });

  test('should identify invalid servers with bad name pattern', () => {
    const serverList = {
      servers: [
        {
          server: {
            name: 'invalid-name-no-slash', // Invalid pattern
            description: 'Invalid server',
            version: '1.0.0',
          },
          _meta: {},
        },
      ],
    };

    const result = validator.validateSchemaData(serverList, 'ServerList', 'test-registry');

    expect(result.isValid).toBe(false);
    expect(result.invalidServerNames.has('invalid-name-no-slash')).toBe(true);
  });

  test('should return empty set when all servers are valid', () => {
    const serverList = {
      servers: [
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
      ],
    };

    const result = validator.validateSchemaData(serverList, 'ServerList', 'test-registry');

    expect(result.isValid).toBe(true);
    expect(result.invalidServerNames.size).toBe(0);
  });
});
