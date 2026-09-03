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

import { createMCPClient } from '@ai-sdk/mcp';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { beforeEach, expect, test, vi } from 'vitest';

import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';

import type { MCPExchanges } from './mcp-exchanges.js';
import { MCPManager } from './mcp-manager.js';

vi.mock(import('@ai-sdk/mcp'));

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn(),
};

const exchanges: MCPExchanges = {
  createMiddleware: vi.fn().mockImplementation((_key: string, transport: Transport) => transport),
  clearExchanges: vi.fn(),
} as unknown as MCPExchanges;

let mcpManager: MCPManager;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(exchanges.createMiddleware).mockImplementation((_key: string, transport: Transport) => transport);
  mcpManager = new MCPManager(apiSender, exchanges);
});

function createMockTransport(): Transport {
  return {} as Transport;
}

function mockMCPClient(toolSet: Record<string, { description?: string }> = {}): void {
  vi.mocked(createMCPClient).mockResolvedValue({
    tools: vi.fn().mockResolvedValue(toolSet),
    close: vi.fn(),
  } as never);
}

test('addClient spawns client on a registered server and updates status', async () => {
  mockMCPClient({ myTool: { description: 'a tool' } });

  mcpManager.registerMCPWithoutClient('provider', 'srv1', 'package', 0, 'Test Server');

  const servers = await mcpManager.listMCPRemoteServers();
  expect(servers).toHaveLength(1);
  expect(servers[0]!.status).toBe('registered');
  expect(servers[0]!.tools).toEqual({});

  await mcpManager.addClient(servers[0]!.id, createMockTransport());

  const updated = await mcpManager.listMCPRemoteServers();
  expect(updated).toHaveLength(1);
  expect(updated[0]!.status).toBeUndefined();
  expect(updated[0]!.tools).toEqual({ myTool: { description: 'a tool' } });
  expect(apiSender.send).toHaveBeenCalledWith('mcp-manager-update');
});

test('removeClient stops client on a spawned server and updates status', async () => {
  mockMCPClient({ myTool: { description: 'a tool' } });

  await mcpManager.registerMCPClient('provider', 'srv1', 'package', 0, 'Test Server', createMockTransport());

  const servers = await mcpManager.listMCPRemoteServers();
  expect(servers[0]!.status).toBeUndefined();
  expect(Object.keys(servers[0]!.tools)).toHaveLength(1);

  await mcpManager.removeClient(servers[0]!.id);

  const updated = await mcpManager.listMCPRemoteServers();
  expect(updated).toHaveLength(1);
  expect(updated[0]!.status).toBe('registered');
  expect(updated[0]!.tools).toEqual({});
  expect(exchanges.clearExchanges).toHaveBeenCalledWith(servers[0]!.id);
});

test('addClient throws if server does not exist', async () => {
  await expect(mcpManager.addClient('nonexistent', createMockTransport())).rejects.toThrow(
    'cannot find MCP server with id nonexistent',
  );
});

test('addClient throws if client already exists', async () => {
  mockMCPClient();

  await mcpManager.registerMCPClient('provider', 'srv1', 'package', 0, 'Test Server', createMockTransport());

  const servers = await mcpManager.listMCPRemoteServers();
  await expect(mcpManager.addClient(servers[0]!.id, createMockTransport())).rejects.toThrow('is already started');
});

test('addClient cleans up client state when tool discovery fails', async () => {
  const close = vi.fn().mockResolvedValue(undefined);
  vi.mocked(createMCPClient).mockResolvedValueOnce({
    tools: vi.fn().mockRejectedValue(new Error('tool discovery failed')),
    close,
  } as never);

  mcpManager.registerMCPWithoutClient('provider', 'srv1', 'package', 0, 'Test Server');

  const servers = await mcpManager.listMCPRemoteServers();
  await expect(mcpManager.addClient(servers[0]!.id, createMockTransport())).rejects.toThrow('tool discovery failed');

  expect(close).toHaveBeenCalled();
  expect(exchanges.clearExchanges).toHaveBeenCalledWith(servers[0]!.id);

  mockMCPClient({ recovered: { description: 'after retry' } });
  await expect(mcpManager.addClient(servers[0]!.id, createMockTransport())).resolves.toBeUndefined();

  const updated = await mcpManager.listMCPRemoteServers();
  expect(updated[0]!.tools).toEqual({ recovered: { description: 'after retry' } });
});

test('removeClient throws if server does not exist', async () => {
  await expect(mcpManager.removeClient('nonexistent')).rejects.toThrow('cannot find MCP server with id nonexistent');
});

test('removeClient is safe when no client exists', async () => {
  mcpManager.registerMCPWithoutClient('provider', 'srv1', 'package', 0, 'Test Server');

  const servers = await mcpManager.listMCPRemoteServers();
  await mcpManager.removeClient(servers[0]!.id);

  const updated = await mcpManager.listMCPRemoteServers();
  expect(updated[0]!.status).toBe('registered');
});
