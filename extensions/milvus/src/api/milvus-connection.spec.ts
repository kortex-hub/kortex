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

import { readFile } from 'node:fs/promises';

import * as api from '@openkaiden/api';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import { beforeEach, expect, test, vi } from 'vitest';

import { MilvusConnection } from './milvus-connection';

vi.mock(import('node:fs/promises'));
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
  const pkg = serverDetail.packages?.[0];
  expect(pkg).toBeDefined();
  expect(pkg?.runtimeHint).toBe('uvx');
  expect(connection.status()).toBe('started');
});

test('should register MCP server with pinned mcp SDK runtime arguments', () => {
  const connection = new MilvusConnection('/path', 'test-db', 'container-1', 19530, true);

  const serverDetail = vi.mocked(api.mcpRegistry.registerServer).mock.calls[0][0];
  const pkg = serverDetail.packages?.[0];
  expect(pkg).toBeDefined();
  expect(pkg?.runtimeArguments).toEqual(
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
  const pkg = serverDetail.packages?.[0];
  expect(pkg).toBeDefined();
  expect(pkg?.identifier).toBe('mcp-server-milvus');
  expect(pkg?.version).toBe('0.1.1.dev9');
  expect(connection.status()).toBe('started');
});

test('should register MCP server with milvus_uri package arguments', () => {
  const connection = new MilvusConnection('/path', 'test-db', 'container-1', 19530, true);

  const serverDetail = vi.mocked(api.mcpRegistry.registerServer).mock.calls[0][0];
  const pkg = serverDetail.packages?.[0];
  expect(pkg).toBeDefined();
  expect(pkg?.packageArguments).toEqual([
    expect.objectContaining({ value: '--milvus_uri' }),
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

test('should sanitize hyphenated names when indexing into milvus collections', async () => {
  const hasCollection = vi.fn().mockResolvedValue({ value: true });
  const insert = vi.fn().mockResolvedValue({});
  const flush = vi.fn().mockResolvedValue({});

  vi.mocked(MilvusClient).mockImplementation(function (this: {
    hasCollection: typeof hasCollection;
    insert: typeof insert;
    flush: typeof flush;
  }): void {
    this.hasCollection = hasCollection;
    this.insert = insert;
    this.flush = flush;
  } as unknown as new (
    ...args: ConstructorParameters<typeof MilvusClient>
  ) => InstanceType<typeof MilvusClient>);
  vi.mocked(readFile).mockResolvedValue('chunk text');
  vi.mocked(api.Uri.file).mockImplementation(
    (path: string) =>
      ({
        fsPath: path,
        toString: (): string => `file://${path}`,
      }) as unknown as api.Uri,
  );

  const connection = new MilvusConnection('/path', 'test-2', 'container-1', 19530, true);
  await connection.index(api.Uri.file('/doc.pdf'), [api.Uri.file('/chunk0.txt')]);

  expect(hasCollection).toHaveBeenCalledWith({ collection_name: 'test_2' });
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({
      collection_name: 'test_2',
    }),
  );
  expect(flush).toHaveBeenCalledWith({ collection_names: ['test_2'] });
});
