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

import * as api from '@openkaiden/api';
import { beforeEach, expect, test, vi } from 'vitest';

import { MilvusConnection } from './milvus-connection';

vi.mock(import('@zilliz/milvus2-sdk-node'));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.mcpRegistry.registerServer).mockReturnValue({
    serverId: 'test-server-id',
    dispose: vi.fn(),
  });
});

test('should register MCP server with uvx runtime hint', () => {
  const connection = new MilvusConnection('/path', 'test-db', 'container-1', 19530, true);

  const serverDetail = vi.mocked(api.mcpRegistry.registerServer).mock.calls[0][0];
  expect(serverDetail.packages[0].runtimeHint).toBe('uvx');
  expect(connection.status()).toBe('started');
});

test('should register MCP server with pinned mcp SDK runtime arguments', () => {
  const connection = new MilvusConnection('/path', 'test-db', 'container-1', 19530, true);

  const serverDetail = vi.mocked(api.mcpRegistry.registerServer).mock.calls[0][0];
  expect(serverDetail.packages[0].runtimeArguments).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ value: '--with' }),
      expect.objectContaining({ value: 'mcp==1.29.0' }),
    ]),
  );
  expect(connection.status()).toBe('started');
});

test('should register MCP server with correct name and version', () => {
  const connection = new MilvusConnection('/path', 'test-db', 'container-1', 19530, true);

  const serverDetail = vi.mocked(api.mcpRegistry.registerServer).mock.calls[0][0];
  expect(serverDetail.name).toBe('kaiden.milvus.mcp-server-milvus-test-db');
  expect(serverDetail.packages[0].identifier).toBe('mcp-server-milvus');
  expect(serverDetail.packages[0].version).toBe('0.1.1.dev8');
  expect(connection.status()).toBe('started');
});

test('should register MCP server with milvus-uri package arguments', () => {
  const connection = new MilvusConnection('/path', 'test-db', 'container-1', 19530, true);

  const serverDetail = vi.mocked(api.mcpRegistry.registerServer).mock.calls[0][0];
  expect(serverDetail.packages[0].packageArguments).toEqual([
    expect.objectContaining({ value: '--milvus-uri' }),
    expect.objectContaining({ value: 'http://localhost:19530' }),
  ]);
  expect(connection.status()).toBe('started');
});

test('should set connection status to started when running is true', () => {
  const connection = new MilvusConnection('/path', 'test-db', 'container-1', 19530, true);
  expect(connection.status()).toBe('started');
});

test('should set connection status to stopped when running is false', () => {
  const connection = new MilvusConnection('/path', 'test-db', 'container-1', 19530, false);
  expect(connection.status()).toBe('stopped');
});

test('should store serverId from registered server', () => {
  const connection = new MilvusConnection('/path', 'test-db', 'container-1', 19530, true);
  expect(connection.mcpServer.serverId).toBe('test-server-id');
});
