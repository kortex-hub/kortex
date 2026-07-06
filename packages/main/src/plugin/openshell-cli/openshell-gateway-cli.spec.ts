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

import type { RunError, RunResult } from '@openkaiden/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import type { Proxy } from '/@/plugin/proxy.js';
import { Exec } from '/@/plugin/util/exec.js';
import type { CliToolInfo } from '/@api/cli-tool-info.js';

import { OpenshellGatewayCli } from './openshell-gateway-cli.js';

vi.mock(import('/@/plugin/util/exec.js'));

const OPENSHELL_CLI_PATH = '/usr/local/bin/openshell';

let openshellGatewayCli: OpenshellGatewayCli;

const exec = new Exec({} as Proxy);
const cliToolRegistry = {
  getCliToolInfos: vi.fn().mockReturnValue([{ name: 'openshell', path: OPENSHELL_CLI_PATH }]),
} as unknown as CliToolRegistry;

function mockExecResult(stdout: string): RunResult {
  return { command: OPENSHELL_CLI_PATH, stdout, stderr: '' };
}

function mockRunError(overrides: Partial<RunError> = {}): RunError {
  const err = new Error(overrides.message ?? 'Command execution failed with exit code 1') as RunError;
  err.exitCode = overrides.exitCode ?? 1;
  err.command = overrides.command ?? OPENSHELL_CLI_PATH;
  err.stdout = overrides.stdout ?? '';
  err.stderr = overrides.stderr ?? '';
  err.cancelled = overrides.cancelled ?? false;
  err.killed = overrides.killed ?? false;
  return err;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(cliToolRegistry.getCliToolInfos).mockReturnValue([
    { name: 'openshell', path: OPENSHELL_CLI_PATH },
  ] as unknown as CliToolInfo[]);
  openshellGatewayCli = new OpenshellGatewayCli(exec, cliToolRegistry);
});

describe('addGateway', () => {
  test('executes gateway add with endpoint', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellGatewayCli.addGateway({ endpoint: 'https://gw.example.com' });

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['gateway', 'add', 'https://gw.example.com'], undefined);
  });

  test('includes --name flag when provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellGatewayCli.addGateway({ endpoint: 'https://gw.example.com', name: 'my-gw' });

    expect(exec.exec).toHaveBeenCalledWith(
      OPENSHELL_CLI_PATH,
      ['gateway', 'add', 'https://gw.example.com', '--name', 'my-gw'],
      undefined,
    );
  });

  test('includes --remote flag when provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellGatewayCli.addGateway({ endpoint: 'https://gw.example.com', remote: 'user@host' });

    expect(exec.exec).toHaveBeenCalledWith(
      OPENSHELL_CLI_PATH,
      ['gateway', 'add', 'https://gw.example.com', '--remote', 'user@host'],
      undefined,
    );
  });

  test('includes --local flag when provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellGatewayCli.addGateway({ endpoint: 'https://127.0.0.1', local: true });

    expect(exec.exec).toHaveBeenCalledWith(
      OPENSHELL_CLI_PATH,
      ['gateway', 'add', 'https://127.0.0.1', '--local'],
      undefined,
    );
  });

  test('extracts JSON error from stdout on failure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const runError = mockRunError({
      stdout: JSON.stringify({ error: 'invalid endpoint' }),
    });
    vi.mocked(exec.exec).mockRejectedValue(runError);

    await expect(openshellGatewayCli.addGateway({ endpoint: 'bad' })).rejects.toThrow('invalid endpoint');
  });
});

describe('removeGateway', () => {
  test('executes gateway remove with name', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellGatewayCli.removeGateway('my-gw');

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['gateway', 'remove', 'my-gw'], undefined);
  });

  test('executes gateway remove without name for active gateway', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellGatewayCli.removeGateway();

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['gateway', 'remove'], undefined);
  });
});

describe('selectGateway', () => {
  test('executes gateway select with name', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellGatewayCli.selectGateway('my-gw');

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['gateway', 'select', 'my-gw'], undefined);
  });

  test('executes gateway select without name', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellGatewayCli.selectGateway();

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['gateway', 'select'], undefined);
  });
});

describe('listGateways', () => {
  test('executes gateway list with json output and returns parsed result', async () => {
    const payload = [
      { name: 'gw-1', endpoint: 'https://gw1.example.com' },
      { name: 'gw-2', endpoint: 'https://gw2.example.com' },
    ];
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(JSON.stringify(payload)));

    const result = await openshellGatewayCli.listGateways();

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['gateway', 'list', '-o', 'json'], undefined);
    expect(result).toEqual(payload);
  });
});

describe('checkEndpointStatus', () => {
  test('returns true when endpoint is healthy', async () => {
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));
    expect(await openshellGatewayCli.checkEndpointStatus('https://127.0.0.1:8443')).toBe(true);
    expect(exec.exec).toHaveBeenCalledWith(
      OPENSHELL_CLI_PATH,
      ['status', '--gateway-endpoint', 'https://127.0.0.1:8443'],
      undefined,
    );
  });

  test('returns false when endpoint is unreachable', async () => {
    vi.mocked(exec.exec).mockRejectedValue(new Error('connection refused'));
    expect(await openshellGatewayCli.checkEndpointStatus('http://127.0.0.1:17670')).toBe(false);
  });

  test('appends --gateway-insecure for http endpoints', async () => {
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));
    await openshellGatewayCli.checkEndpointStatus('http://127.0.0.1:17670');
    expect(exec.exec).toHaveBeenCalledWith(
      OPENSHELL_CLI_PATH,
      ['status', '--gateway-endpoint', 'http://127.0.0.1:17670', '--gateway-insecure'],
      undefined,
    );
  });

  test('does not append --gateway-insecure for https endpoints', async () => {
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));
    await openshellGatewayCli.checkEndpointStatus('https://127.0.0.1:8443');
    expect(exec.exec).toHaveBeenCalledWith(
      OPENSHELL_CLI_PATH,
      expect.not.arrayContaining(['--gateway-insecure']),
      undefined,
    );
  });
});

describe('getGatewayStatus', () => {
  test('executes status and returns trimmed output', async () => {
    const statusText = 'Server Status\n\n  Gateway: openshell\n  Status: Connected\n';
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(statusText));

    const result = await openshellGatewayCli.getGatewayStatus();

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['status']);
    expect(result).toBe(statusText.trim());
  });

  test('rejects when no gateway is configured', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockRejectedValue(new Error('no gateway configured'));

    await expect(openshellGatewayCli.getGatewayStatus()).rejects.toThrow('no gateway configured');
  });
});
