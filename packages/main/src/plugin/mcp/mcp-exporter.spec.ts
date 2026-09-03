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

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { MCPExporter } from '/@/plugin/mcp/mcp-exporter.js';
import { isMac, isWindows } from '/@/util.js';
import type { MCPExportTarget } from '/@api/mcp/mcp-export.js';
import { CLAUDE_CODE, CLAUDE_DESKTOP, CURSOR, VSCODE } from '/@api/mcp/mcp-export.js';

import type { MCPRegistry } from './mcp-registry.js';

vi.mock(import('node:fs'));
vi.mock(import('node:fs/promises'));
vi.mock(import('node:os'));
vi.mock(import('/@/util.js'));

const mockMcpRegistry = {
  getConfigurations: vi.fn(),
  listMCPServersFromRegistries: vi.fn(),
} as unknown as MCPRegistry;

let exporter: MCPExporter;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(homedir).mockReturnValue('/home/testuser');
  vi.mocked(existsSync).mockReturnValue(false);
  vi.mocked(mkdir).mockResolvedValue(undefined);
  vi.mocked(writeFile).mockResolvedValue(undefined);
  vi.mocked(isWindows).mockReturnValue(false);
  vi.mocked(isMac).mockReturnValue(false);
  exporter = new MCPExporter(mockMcpRegistry);
});

describe('buildPackageEntry', () => {
  const npmPackage = {
    registryType: 'npm',
    identifier: '@example/mcp-server',
    version: '1.0.0',
    transport: { type: 'stdio' as const },
  };

  const pypiPackage = {
    registryType: 'pypi',
    identifier: 'mcp-server-example',
    version: '2.0.0',
    transport: { type: 'stdio' as const },
  };

  const config = {
    runtimeArguments: ['--no-warnings'],
    packageArguments: ['--port', '3000'],
    environmentVariables: { API_KEY: 'test-key' },
  };

  test('npm package for claude-desktop', () => {
    const result = exporter.buildPackageEntry(CLAUDE_DESKTOP, npmPackage, config);
    expect(result).toEqual({
      command: 'npx',
      args: ['--no-warnings', '@example/mcp-server@1.0.0', '--port', '3000'],
      env: { API_KEY: 'test-key' },
    });
    expect(result).not.toHaveProperty('type');
  });

  test('npm package for claude-code', () => {
    const result = exporter.buildPackageEntry(CLAUDE_CODE, npmPackage, config);
    expect(result).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['--no-warnings', '@example/mcp-server@1.0.0', '--port', '3000'],
      env: { API_KEY: 'test-key' },
    });
  });

  test('npm package for cursor', () => {
    const result = exporter.buildPackageEntry(CURSOR, npmPackage, config);
    expect(result).toEqual({
      command: 'npx',
      args: ['--no-warnings', '@example/mcp-server@1.0.0', '--port', '3000'],
      env: { API_KEY: 'test-key' },
    });
    expect(result).not.toHaveProperty('type');
  });

  test('npm package for vscode', () => {
    const result = exporter.buildPackageEntry(VSCODE, npmPackage, config);
    expect(result).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['--no-warnings', '@example/mcp-server@1.0.0', '--port', '3000'],
      env: { API_KEY: 'test-key' },
    });
  });

  test('pypi package for claude-desktop', () => {
    const result = exporter.buildPackageEntry(CLAUDE_DESKTOP, pypiPackage, config);
    expect(result).toEqual({
      command: 'uvx',
      args: ['--no-warnings', 'mcp-server-example==2.0.0', '--port', '3000'],
      env: { API_KEY: 'test-key' },
    });
  });

  test('pypi package for claude-code', () => {
    const result = exporter.buildPackageEntry(CLAUDE_CODE, pypiPackage, config);
    expect(result).toEqual({
      type: 'stdio',
      command: 'uvx',
      args: ['--no-warnings', 'mcp-server-example==2.0.0', '--port', '3000'],
      env: { API_KEY: 'test-key' },
    });
  });

  test('package without version', () => {
    const noVersionPack = { ...npmPackage, version: undefined };
    const result = exporter.buildPackageEntry(CLAUDE_DESKTOP, noVersionPack, {});
    expect(result).toEqual({
      command: 'npx',
      args: ['@example/mcp-server'],
    });
  });

  test('package without env vars omits env field', () => {
    const result = exporter.buildPackageEntry(CLAUDE_DESKTOP, npmPackage, {});
    expect(result).not.toHaveProperty('env');
  });

  test('package with empty env vars omits env field', () => {
    const result = exporter.buildPackageEntry(CLAUDE_DESKTOP, npmPackage, { environmentVariables: {} });
    expect(result).not.toHaveProperty('env');
  });
});

describe('buildRemoteEntry', () => {
  const remote = {
    type: 'streamable-http' as const,
    url: 'https://remote.server/mcp',
  };

  const headers = {
    Authorization: 'Bearer token123',
    'X-Api-Key': 'key456',
  };

  test('remote for claude-code uses native http', () => {
    const result = exporter.buildRemoteEntry(CLAUDE_CODE, remote, headers);
    expect(result).toEqual({
      type: 'http',
      url: 'https://remote.server/mcp',
      headers: {
        Authorization: 'Bearer token123',
        'X-Api-Key': 'key456',
      },
    });
  });

  test('remote for claude-desktop uses mcp-remote proxy', () => {
    const result = exporter.buildRemoteEntry(CLAUDE_DESKTOP, remote, headers);
    expect(result).toEqual({
      command: 'npx',
      args: [
        'mcp-remote',
        'https://remote.server/mcp',
        '--header',
        'Authorization:${MCP_HEADER_AUTHORIZATION}',
        '--header',
        'X-Api-Key:${MCP_HEADER_X_API_KEY}',
      ],
      env: {
        MCP_HEADER_AUTHORIZATION: 'Bearer token123',
        MCP_HEADER_X_API_KEY: 'key456',
      },
    });
    expect(result).not.toHaveProperty('type');
  });

  test('remote for cursor uses mcp-remote proxy', () => {
    const result = exporter.buildRemoteEntry(CURSOR, remote, headers);
    expect(result).toEqual({
      command: 'npx',
      args: [
        'mcp-remote',
        'https://remote.server/mcp',
        '--header',
        'Authorization:${MCP_HEADER_AUTHORIZATION}',
        '--header',
        'X-Api-Key:${MCP_HEADER_X_API_KEY}',
      ],
      env: {
        MCP_HEADER_AUTHORIZATION: 'Bearer token123',
        MCP_HEADER_X_API_KEY: 'key456',
      },
    });
  });

  test('remote for vscode uses native http transport', () => {
    const result = exporter.buildRemoteEntry(VSCODE, remote, headers);
    expect(result).toEqual({
      type: 'http',
      url: 'https://remote.server/mcp',
      headers: {
        Authorization: 'Bearer token123',
        'X-Api-Key': 'key456',
      },
    });
  });

  test('remote sse for vscode uses native sse transport', () => {
    const sseRemote = { type: 'sse' as const, url: 'https://remote.server/sse' };
    const result = exporter.buildRemoteEntry(VSCODE, sseRemote, headers);
    expect(result).toEqual({
      type: 'http',
      url: 'https://remote.server/sse',
      headers: {
        Authorization: 'Bearer token123',
        'X-Api-Key': 'key456',
      },
    });
  });

  test('remote with no headers for vscode', () => {
    const result = exporter.buildRemoteEntry(VSCODE, remote, {});
    expect(result).toEqual({
      type: 'http',
      url: 'https://remote.server/mcp',
    });
    expect(result).not.toHaveProperty('headers');
  });

  test('remote with no headers for claude-code', () => {
    const result = exporter.buildRemoteEntry(CLAUDE_CODE, remote, {});
    expect(result).toEqual({
      type: 'http',
      url: 'https://remote.server/mcp',
    });
    expect(result).not.toHaveProperty('headers');
  });

  test('remote with no headers for claude-desktop', () => {
    const result = exporter.buildRemoteEntry(CLAUDE_DESKTOP, remote, {});
    expect(result).toEqual({
      command: 'npx',
      args: ['mcp-remote', 'https://remote.server/mcp'],
    });
    expect(result).not.toHaveProperty('env');
  });
});

describe('getConfigFilePath', () => {
  test('claude-desktop on macOS', () => {
    vi.mocked(isMac).mockReturnValue(true);
    const result = exporter.getConfigFilePath(CLAUDE_DESKTOP);
    expect(result).toBe(
      join('/home/testuser', 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    );
  });

  test('claude-desktop on linux', () => {
    const result = exporter.getConfigFilePath(CLAUDE_DESKTOP);
    expect(result).toBe(join('/home/testuser', '.config', 'Claude', 'claude_desktop_config.json'));
  });

  test('claude-desktop on windows', () => {
    vi.mocked(isWindows).mockReturnValue(true);
    process.env['APPDATA'] = 'C:\\Users\\test\\AppData\\Roaming';
    const result = exporter.getConfigFilePath(CLAUDE_DESKTOP);
    expect(result).toBe(join('C:\\Users\\test\\AppData\\Roaming', 'Claude', 'claude_desktop_config.json'));
    delete process.env['APPDATA'];
  });

  test('claude-code', () => {
    const result = exporter.getConfigFilePath(CLAUDE_CODE);
    expect(result).toBe(join('/home/testuser', '.claude.json'));
  });

  test('cursor', () => {
    const result = exporter.getConfigFilePath(CURSOR);
    expect(result).toBe(join('/home/testuser', '.cursor', 'mcp.json'));
  });

  test('vscode', () => {
    const result = exporter.getConfigFilePath(VSCODE);
    expect(result).toBe(join('/home/testuser', '.vscode', 'mcp.json'));
  });
});

describe('writeEntry', () => {
  test('creates directory and writes new file when none exists', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const entry = { command: 'npx', args: ['test@1.0'] };
    await exporter.writeEntry(CURSOR, 'my-server', entry);

    expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify({ mcpServers: { 'my-server': entry } }, undefined, 2),
      'utf-8',
    );
  });

  test('merges into existing config file', async () => {
    const existingContent = JSON.stringify({
      mcpServers: { 'existing-server': { command: 'npx', args: ['existing@1.0'] } },
    });

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(existingContent);

    const entry = { command: 'npx', args: ['new@2.0'] };
    await exporter.writeEntry(CURSOR, 'new-server', entry);

    const writtenContent = vi.mocked(writeFile).mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(writtenContent);
    expect(parsed.mcpServers['existing-server']).toEqual({ command: 'npx', args: ['existing@1.0'] });
    expect(parsed.mcpServers['new-server']).toEqual(entry);
  });

  test('overwrites existing server entry by name', async () => {
    const existingContent = JSON.stringify({
      mcpServers: { 'my-server': { command: 'npx', args: ['old@1.0'] } },
    });

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(existingContent);

    const entry = { command: 'npx', args: ['updated@2.0'] };
    await exporter.writeEntry(CURSOR, 'my-server', entry);

    const writtenContent = vi.mocked(writeFile).mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(writtenContent);
    expect(parsed.mcpServers['my-server']).toEqual(entry);
  });

  test('uses "servers" key for vscode', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const entry = { type: 'stdio' as const, command: 'npx', args: ['test@1.0'] };
    await exporter.writeEntry(VSCODE, 'my-server', entry);

    const writtenContent = vi.mocked(writeFile).mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(writtenContent);
    expect(parsed.servers['my-server']).toEqual(entry);
    expect(parsed).not.toHaveProperty('mcpServers');
  });

  test('uses "mcpServers" key for claude-desktop', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const entry = { command: 'npx', args: ['test@1.0'] };
    await exporter.writeEntry(CLAUDE_DESKTOP, 'my-server', entry);

    const writtenContent = vi.mocked(writeFile).mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(writtenContent);
    expect(parsed.mcpServers['my-server']).toEqual(entry);
  });

  test('preserves non-mcpServers keys in existing file', async () => {
    const existingContent = JSON.stringify({
      someOtherKey: 'value',
      mcpServers: { 'existing-server': { command: 'npx', args: ['existing@1.0'] } },
    });

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(existingContent);

    const entry = { command: 'npx', args: ['new@2.0'] };
    await exporter.writeEntry(CLAUDE_CODE, 'new-server', entry);

    const writtenContent = vi.mocked(writeFile).mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(writtenContent);
    expect(parsed.someOtherKey).toBe('value');
  });

  test('handles invalid JSON in existing file gracefully', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue('not valid json{{{');

    const entry = { command: 'npx', args: ['test@1.0'] };
    await exporter.writeEntry(CURSOR, 'my-server', entry);

    const writtenContent = vi.mocked(writeFile).mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(writtenContent);
    expect(parsed.mcpServers['my-server']).toEqual(entry);
  });
});

describe('exportServer', () => {
  const serverDetail = {
    serverId: 'test-server',
    name: 'io.example/test-server',
    description: 'Test server',
    version: '1.0.0',
    packages: [
      {
        registryType: 'npm',
        identifier: '@example/test-mcp',
        version: '1.0.0',
        transport: { type: 'stdio' as const },
      },
    ],
    remotes: [
      {
        type: 'streamable-http' as const,
        url: 'https://remote.test/mcp',
      },
    ],
  };

  test('exports package-based server', async () => {
    vi.mocked(mockMcpRegistry.getConfigurations).mockResolvedValue([
      {
        serverId: 'test-server',
        packageId: 0,
        runtimeArguments: [],
        packageArguments: [],
        environmentVariables: {},
      },
    ]);
    vi.mocked(mockMcpRegistry.listMCPServersFromRegistries).mockResolvedValue([serverDetail]);
    vi.mocked(existsSync).mockReturnValue(false);

    await exporter.exportServer('test-server', CURSOR);

    expect(writeFile).toHaveBeenCalled();
    const writtenContent = vi.mocked(writeFile).mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(writtenContent);
    expect(parsed.mcpServers['io.example/test-server']).toBeDefined();
    expect(parsed.mcpServers['io.example/test-server'].command).toBe('npx');
  });

  test('exports remote server', async () => {
    vi.mocked(mockMcpRegistry.getConfigurations).mockResolvedValue([
      {
        serverId: 'test-server',
        remoteId: 0,
        headers: { Authorization: 'Bearer tok' },
      },
    ]);
    vi.mocked(mockMcpRegistry.listMCPServersFromRegistries).mockResolvedValue([serverDetail]);
    vi.mocked(existsSync).mockReturnValue(false);

    await exporter.exportServer('test-server', CLAUDE_CODE);

    expect(writeFile).toHaveBeenCalled();
    const writtenContent = vi.mocked(writeFile).mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(writtenContent);
    expect(parsed.mcpServers['io.example/test-server'].type).toBe('http');
    expect(parsed.mcpServers['io.example/test-server'].url).toBe('https://remote.test/mcp');
  });

  test('throws when no stored configuration found', async () => {
    vi.mocked(mockMcpRegistry.getConfigurations).mockResolvedValue([]);
    vi.mocked(mockMcpRegistry.listMCPServersFromRegistries).mockResolvedValue([serverDetail]);

    await expect(exporter.exportServer('test-server', CURSOR)).rejects.toThrow(
      'No stored configuration found for server "test-server"',
    );
  });

  test('throws when server detail not found', async () => {
    vi.mocked(mockMcpRegistry.getConfigurations).mockResolvedValue([{ serverId: 'test-server', packageId: 0 }]);
    vi.mocked(mockMcpRegistry.listMCPServersFromRegistries).mockResolvedValue([]);

    await expect(exporter.exportServer('test-server', CURSOR)).rejects.toThrow(
      'Server detail not found for "test-server"',
    );
  });

  test('throws when package index not found', async () => {
    vi.mocked(mockMcpRegistry.getConfigurations).mockResolvedValue([{ serverId: 'test-server', packageId: 5 }]);
    vi.mocked(mockMcpRegistry.listMCPServersFromRegistries).mockResolvedValue([serverDetail]);

    await expect(exporter.exportServer('test-server', CURSOR)).rejects.toThrow(
      'Package entry at index 5 not found for "test-server"',
    );
  });

  test('throws when remote index not found', async () => {
    vi.mocked(mockMcpRegistry.getConfigurations).mockResolvedValue([
      { serverId: 'test-server', remoteId: 5, headers: {} },
    ]);
    vi.mocked(mockMcpRegistry.listMCPServersFromRegistries).mockResolvedValue([serverDetail]);

    await expect(exporter.exportServer('test-server', CURSOR)).rejects.toThrow(
      'Remote entry at index 5 not found for "test-server"',
    );
  });

  test.each([
    CLAUDE_DESKTOP,
    CLAUDE_CODE,
    CURSOR,
    VSCODE,
  ] as MCPExportTarget[])('exports npm package to %s', async (target: MCPExportTarget) => {
    vi.mocked(mockMcpRegistry.getConfigurations).mockResolvedValue([
      {
        serverId: 'test-server',
        packageId: 0,
        runtimeArguments: ['--no-warnings'],
        packageArguments: ['--verbose'],
        environmentVariables: { TOKEN: 'abc' },
      },
    ]);
    vi.mocked(mockMcpRegistry.listMCPServersFromRegistries).mockResolvedValue([serverDetail]);
    vi.mocked(existsSync).mockReturnValue(false);

    await exporter.exportServer('test-server', target);

    expect(writeFile).toHaveBeenCalled();
    const writtenContent = vi.mocked(writeFile).mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(writtenContent);
    const key = target === VSCODE ? 'servers' : 'mcpServers';
    expect(parsed[key]['io.example/test-server']).toBeDefined();
    expect(parsed[key]['io.example/test-server'].command).toBe('npx');
    expect(parsed[key]['io.example/test-server'].args).toContain('--no-warnings');
    expect(parsed[key]['io.example/test-server'].args).toContain('@example/test-mcp@1.0.0');
  });
});
