/**********************************************************************
 * Copyright (C) 2024 Red Hat, Inc.
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
import { readFile, writeFile } from 'node:fs/promises';

import { safeStorage } from 'electron';
import { beforeEach, expect, test, vi } from 'vitest';

import { type Directories } from '/@/plugin/directories.js';

import type { SecretStorageChangeEvent } from './safe-storage-registry.js';
import { SafeStorageRegistry } from './safe-storage-registry.js';

vi.mock('electron', () => ({
  safeStorage: {
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}));

vi.mock('node:fs');
vi.mock('node:fs/promises');

let safeStorageRegistry: SafeStorageRegistry;

const directories = {
  getSafeStorageDirectory: () => '/fake-safe-storage-directory',
} as unknown as Directories;

beforeEach(() => {
  safeStorageRegistry = new SafeStorageRegistry(directories);
});

test('should init safe storage', async () => {
  // mock existsSync
  vi.mocked(existsSync).mockReturnValue(false);

  vi.mocked(readFile).mockResolvedValue('{}');

  const encryptedValue = Buffer.from('encryptedValue');
  vi.mocked(safeStorage.encryptString).mockReturnValue(encryptedValue);
  vi.mocked(safeStorage.decryptString).mockReturnValue('originalValue');

  // register configuration
  const notifications = await safeStorageRegistry.init();
  expect(notifications).toBeDefined();
  expect(notifications.length).toBe(0);

  // get getExtensionStorage
  const extensionSpecificStorage = safeStorageRegistry.getExtensionStorage('id1');

  // reset the writeFile
  vi.mocked(writeFile).mockClear();

  let key = await extensionSpecificStorage.get('key1');
  expect(key).toBeUndefined();

  const onDidChangeEvent = extensionSpecificStorage.onDidChange;
  const events: SecretStorageChangeEvent[] = [];
  onDidChangeEvent(event => {
    events.push(event);
  });
  await extensionSpecificStorage.store('key1', 'value1');
  expect(events).toEqual([{ key: 'key1' }]);

  // expect file is being written
  expect(safeStorage.encryptString).toHaveBeenCalledWith('value1');

  // full key should be extension Id and key
  const fullKey = 'id1.key1';
  const base64Encrypted = encryptedValue.toString('base64');

  const expectedData = {
    [fullKey]: base64Encrypted,
  };

  expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
    expect.stringContaining('data.json'),
    JSON.stringify(expectedData),
    'utf-8',
  );

  // read again the value
  key = await extensionSpecificStorage.get('key1');
  expect(key).toBe('originalValue');

  // check delete
  events.length = 0;
  await extensionSpecificStorage.delete('key1');
  expect(vi.mocked(writeFile)).toHaveBeenCalledWith(expect.stringContaining('data.json'), JSON.stringify({}), 'utf-8');

  // check change event
  expect(events).toEqual([{ key: 'key1' }]);
});

test('should init safe storage if error', async () => {
  // mock existsSync
  vi.mocked(existsSync).mockReturnValue(false);

  vi.mocked(readFile).mockResolvedValue('invalid JSON content');

  // register configuration
  const notifications = await safeStorageRegistry.init();
  expect(notifications).toBeDefined();
  expect(notifications.length).toBe(1);
});

test('should throw error if not initialized', async () => {
  expect(() => safeStorageRegistry.getExtensionStorage('foo')).toThrow('Safe storage not initialized');
});

test('should hide all secrets in content', async () => {
  // Setup
  vi.mocked(existsSync).mockReturnValue(false);
  vi.mocked(readFile).mockResolvedValue('{}');

  const encryptedValue1 = Buffer.from('encrypted1');
  const encryptedValue2 = Buffer.from('encrypted2');

  // Mock encrypt to return different values for different inputs
  vi.mocked(safeStorage.encryptString).mockImplementation((value: string) => {
    if (value === 'secret-token-123') return encryptedValue1;
    if (value === 'api-key-xyz') return encryptedValue2;
    return Buffer.from('encrypted');
  });

  // Mock decrypt to return original values
  vi.mocked(safeStorage.decryptString).mockImplementation((buffer: Buffer) => {
    if (buffer.equals(encryptedValue1)) return 'secret-token-123';
    if (buffer.equals(encryptedValue2)) return 'api-key-xyz';
    return 'decrypted';
  });

  await safeStorageRegistry.init();

  // Store some secrets
  const storage1 = safeStorageRegistry.getExtensionStorage('ext1');
  const storage2 = safeStorageRegistry.getExtensionStorage('ext2');

  await storage1.store('token', 'secret-token-123');
  await storage2.store('apiKey', 'api-key-xyz');

  const content = `
apiVersion: v1
kind: ConfigMap
data:
  TOKEN: secret-token-123
  API_KEY: api-key-xyz
  MIXED: "The token secret-token-123 and key api-key-xyz should be hidden"
`;

  const result = await safeStorageRegistry.hideSecretsInContent(content);

  // Verify secrets are hidden
  expect(result).not.toContain('secret-token-123');
  expect(result).not.toContain('api-key-xyz');

  // Verify mask
  expect(result).toContain('********************');
});

test('should handle empty content when hiding secrets', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  vi.mocked(readFile).mockResolvedValue('{}');

  await safeStorageRegistry.init();

  const result = await safeStorageRegistry.hideSecretsInContent('');
  expect(result).toBe('');
});

test('should hide secrets stored as JSON objects', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  vi.mocked(readFile).mockResolvedValue('{}');

  const jsonConfig = JSON.stringify([
    {
      serverId: 'github-mcp',
      remoteId: 1,
      headers: {
        Authorization: 'ghp_secret_token_abc123',
        'X-API-Key': 'api-key-xyz789',
      },
    },
  ]);

  const encryptedJson = Buffer.from('encrypted-json');
  vi.mocked(safeStorage.encryptString).mockReturnValue(encryptedJson);
  vi.mocked(safeStorage.decryptString).mockReturnValue(jsonConfig);

  await safeStorageRegistry.init();

  const storage = safeStorageRegistry.getCoreStorage();
  await storage.store('mcp-config', jsonConfig);

  const content = `
apiVersion: v1
kind: ConfigMap
data:
  config.yaml: |
    extensions:
      - name: github-mcp
        headers:
          Authorization: ghp_secret_token_abc123
          X-API-Key: api-key-xyz789
`;

  const result = await safeStorageRegistry.hideSecretsInContent(content);

  // Verify individual values from JSON are hidden
  expect(result).not.toContain('ghp_secret_token_abc123');
  expect(result).not.toContain('api-key-xyz789');
  expect(result).toContain('********************');
});
