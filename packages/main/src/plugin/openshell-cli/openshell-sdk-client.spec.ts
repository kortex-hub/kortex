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

import { homedir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { GatewayInfo } from '/@api/openshell-gateway-info.js';

import { OpenshellSdkClient } from './openshell-sdk-client.js';

vi.mock(import('node:fs/promises'));
vi.mock(import('node:os'));
vi.mock(import('@nvidia/openshell-sdk'));
vi.mock(import('/@/plugin/openshell-cli/openshell-cli.js'));

const mockConnect = vi.fn();

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(homedir).mockReturnValue('/home/testuser');

  const sdk = await import('@nvidia/openshell-sdk');
  vi.mocked(sdk.OpenShellClient.connect).mockImplementation(mockConnect);
  mockConnect.mockResolvedValue({ sandbox: {}, raw: {}, transport: {} });
});

function gateway(overrides: Partial<GatewayInfo> = {}): GatewayInfo {
  return {
    name: 'kaiden-local',
    endpoint: 'http://127.0.0.1:17670',
    active: true,
    ...overrides,
  };
}

function createSdkClient(listGateways: () => Promise<GatewayInfo[]>): OpenshellSdkClient {
  const openshellCli = { listGateways } as never;
  return new OpenshellSdkClient(openshellCli);
}

describe('OpenshellSdkClient', () => {
  describe('getClient', () => {
    test('connects with gateway URL only for http endpoints', async () => {
      const gw = gateway();
      const sdkClient = createSdkClient(async () => [gw]);

      await sdkClient.getClient();

      expect(mockConnect).toHaveBeenCalledWith({ gateway: 'http://127.0.0.1:17670' });
    });

    test('loads mTLS certs for https endpoints', async () => {
      vi.stubEnv('XDG_CONFIG_HOME', '/test/config');
      const { readFile } = await import('node:fs/promises');
      vi.mocked(readFile)
        .mockResolvedValueOnce(Buffer.from('ca-data'))
        .mockResolvedValueOnce(Buffer.from('cert-data'))
        .mockResolvedValueOnce(Buffer.from('key-data'));

      const gw = gateway({ name: 'remote-gw', endpoint: 'https://gw.example.com', auth: 'mtls' });
      const sdkClient = createSdkClient(async () => [gw]);

      await sdkClient.getClient('remote-gw');

      const expectedMtlsDir = join('/test/config', 'openshell', 'gateways', 'remote-gw', 'mtls');
      expect(vi.mocked(readFile)).toHaveBeenCalledWith(join(expectedMtlsDir, 'ca.crt'));
      expect(vi.mocked(readFile)).toHaveBeenCalledWith(join(expectedMtlsDir, 'tls.crt'));
      expect(vi.mocked(readFile)).toHaveBeenCalledWith(join(expectedMtlsDir, 'tls.key'));
      expect(mockConnect).toHaveBeenCalledWith({
        gateway: 'https://gw.example.com',
        caCert: Buffer.from('ca-data'),
        clientCert: Buffer.from('cert-data'),
        clientKey: Buffer.from('key-data'),
      });
    });

    test('passes undefined certs when mTLS files are missing', async () => {
      vi.stubEnv('XDG_CONFIG_HOME', '/test/config');
      const { readFile } = await import('node:fs/promises');
      const enoent = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
      vi.mocked(readFile).mockRejectedValue(enoent);

      const gw = gateway({ name: 'no-certs', endpoint: 'https://gw.example.com' });
      const sdkClient = createSdkClient(async () => [gw]);

      await sdkClient.getClient('no-certs');

      expect(mockConnect).toHaveBeenCalledWith({
        gateway: 'https://gw.example.com',
        caCert: undefined,
        clientCert: undefined,
        clientKey: undefined,
      });
    });

    test('propagates non-ENOENT cert read errors', async () => {
      vi.stubEnv('XDG_CONFIG_HOME', '/test/config');
      const { readFile } = await import('node:fs/promises');
      const permError = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      vi.mocked(readFile).mockRejectedValue(permError);

      const gw = gateway({ name: 'bad-perms', endpoint: 'https://gw.example.com' });
      const sdkClient = createSdkClient(async () => [gw]);

      await expect(sdkClient.getClient('bad-perms')).rejects.toThrow(/EACCES/);
    });

    test('respects XDG_CONFIG_HOME', async () => {
      const { readFile } = await import('node:fs/promises');
      const enoent = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
      vi.mocked(readFile).mockRejectedValue(enoent);
      vi.stubEnv('XDG_CONFIG_HOME', '/custom/config');

      const gw = gateway({ name: 'xdg-gw', endpoint: 'https://gw.example.com' });
      const sdkClient = createSdkClient(async () => [gw]);

      await sdkClient.getClient('xdg-gw');

      const expectedMtlsDir = join('/custom/config', 'openshell', 'gateways', 'xdg-gw', 'mtls');
      expect(vi.mocked(readFile)).toHaveBeenCalledWith(join(expectedMtlsDir, 'ca.crt'));

      vi.unstubAllEnvs();
    });

    test('caches client for same gateway name', async () => {
      const gw = gateway();
      const sdkClient = createSdkClient(async () => [gw]);

      const first = await sdkClient.getClient();
      const second = await sdkClient.getClient();

      expect(first).toBe(second);
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    test('creates separate clients for different gateways', async () => {
      const localGw = gateway({ name: 'local', endpoint: 'http://127.0.0.1:17670', active: true });
      const remoteGw = gateway({ name: 'remote', endpoint: 'http://10.0.0.1:17670', active: false });
      const sdkClient = createSdkClient(async () => [localGw, remoteGw]);

      mockConnect.mockResolvedValueOnce({ id: 'client-local' }).mockResolvedValueOnce({ id: 'client-remote' });

      const first = await sdkClient.getClient('local');
      const second = await sdkClient.getClient('remote');

      expect(first).not.toBe(second);
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    test('selects active gateway when no name is provided', async () => {
      const inactive = gateway({ name: 'inactive', active: false });
      const active = gateway({ name: 'active-gw', endpoint: 'http://127.0.0.1:17670', active: true });
      const sdkClient = createSdkClient(async () => [inactive, active]);

      await sdkClient.getClient();

      expect(mockConnect).toHaveBeenCalledWith({ gateway: 'http://127.0.0.1:17670' });
    });

    test('selects sole gateway when none is active', async () => {
      const gw = gateway({ active: false });
      const sdkClient = createSdkClient(async () => [gw]);

      await sdkClient.getClient();

      expect(mockConnect).toHaveBeenCalledWith({ gateway: 'http://127.0.0.1:17670' });
    });

    test('throws when named gateway is not found', async () => {
      const sdkClient = createSdkClient(async () => [gateway()]);

      await expect(sdkClient.getClient('missing')).rejects.toThrow(/gateway 'missing' not found/i);
    });

    test('throws when no gateways are registered', async () => {
      const sdkClient = createSdkClient(async () => []);

      await expect(sdkClient.getClient()).rejects.toThrow(/no openshell gateways registered/i);
    });

    test('throws when multiple gateways exist but none is active', async () => {
      const gw1 = gateway({ name: 'gw1', active: false });
      const gw2 = gateway({ name: 'gw2', active: false });
      const sdkClient = createSdkClient(async () => [gw1, gw2]);

      await expect(sdkClient.getClient()).rejects.toThrow(/multiple.*none is active/i);
    });
  });

  describe('invalidate', () => {
    test('clears cache for a specific gateway', async () => {
      const gw = gateway();
      const sdkClient = createSdkClient(async () => [gw]);

      await sdkClient.getClient();
      sdkClient.invalidate('kaiden-local');
      await sdkClient.getClient();

      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    test('clears entire cache when no name is given', async () => {
      const gw = gateway();
      const sdkClient = createSdkClient(async () => [gw]);

      await sdkClient.getClient();
      sdkClient.invalidate();
      await sdkClient.getClient();

      expect(mockConnect).toHaveBeenCalledTimes(2);
    });
  });

  describe('dispose', () => {
    test('clears cache on dispose', async () => {
      const gw = gateway();
      const sdkClient = createSdkClient(async () => [gw]);

      await sdkClient.getClient();
      sdkClient.dispose();
      await sdkClient.getClient();

      expect(mockConnect).toHaveBeenCalledTimes(2);
    });
  });
});
