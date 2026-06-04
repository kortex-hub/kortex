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

import { OpenshellCli } from './openshell-cli.js';

vi.mock(import('/@/plugin/util/exec.js'));

const OPENSHELL_CLI_PATH = '/usr/local/bin/openshell';

let openshellCli: OpenshellCli;

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
  openshellCli = new OpenshellCli(exec, cliToolRegistry);
});

describe('getCliPath', () => {
  test('returns path from CLI tool registry', () => {
    expect(openshellCli.getCliPath()).toBe(OPENSHELL_CLI_PATH);
  });

  test('falls back to openshell when no CLI tool is registered', () => {
    vi.mocked(cliToolRegistry.getCliToolInfos).mockReturnValue([]);
    expect(openshellCli.getCliPath()).toBe('openshell');
  });

  test('falls back to openshell when tool has no path', () => {
    vi.mocked(cliToolRegistry.getCliToolInfos).mockReturnValue([{ name: 'openshell' }] as unknown as CliToolInfo[]);
    expect(openshellCli.getCliPath()).toBe('openshell');
  });
});

describe('getVersion', () => {
  test('executes openshell --version and returns trimmed output', async () => {
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell 0.0.52\n'));

    const result = await openshellCli.getVersion();

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['--version']);
    expect(result).toBe('openshell 0.0.52');
  });

  test('rejects when CLI fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockRejectedValue(new Error('command not found'));

    await expect(openshellCli.getVersion()).rejects.toThrow('command not found');
  });
});

describe('createSandbox', () => {
  test('executes openshell sandbox create with defaults', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.createSandbox();

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['sandbox', 'create']);
  });

  test('includes --name flag when provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.createSandbox({ name: 'my-sandbox' });

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['sandbox', 'create', '--name', 'my-sandbox']);
  });

  test('includes --from flag when provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.createSandbox({ from: 'python' });

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['sandbox', 'create', '--from', 'python']);
  });

  test('includes -g flag and gateway label when gateway is provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.createSandbox({ gateway: 'my-gw' });

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, [
      'sandbox',
      'create',
      '-g',
      'my-gw',
      '--label',
      'gateway=my-gw',
    ]);
  });

  test('includes resource flags when provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.createSandbox({ gpu: true, cpu: '2', memory: '4Gi' });

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, [
      'sandbox',
      'create',
      '--gpu',
      '--cpu',
      '2',
      '--memory',
      '4Gi',
    ]);
  });

  test('includes --provider flags when provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.createSandbox({ providers: ['openai', 'anthropic'] });

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, [
      'sandbox',
      'create',
      '--provider',
      'openai',
      '--provider',
      'anthropic',
    ]);
  });

  test('includes --label flags when provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.createSandbox({ labels: { env: 'dev', team: 'platform' } });

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, [
      'sandbox',
      'create',
      '--label',
      'env=dev',
      '--label',
      'team=platform',
    ]);
  });

  test('appends command after -- separator', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.createSandbox({ command: ['bash', '-c', 'echo hello'] });

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['sandbox', 'create', '--', 'bash', '-c', 'echo hello']);
  });

  test('rejects when CLI fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockRejectedValue(new Error('no active gateway'));

    await expect(openshellCli.createSandbox()).rejects.toThrow('no active gateway');
  });

  test('extracts JSON error from stdout on failure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const runError = mockRunError({
      stdout: JSON.stringify({ error: 'gateway connection refused' }),
    });
    vi.mocked(exec.exec).mockRejectedValue(runError);

    await expect(openshellCli.createSandbox()).rejects.toThrow('gateway connection refused');
  });
});

describe('listSandboxes', () => {
  test('executes openshell sandbox list with json output', async () => {
    const payload = [{ id: 'sb-1', name: 'sb-1', phase: 'Running' }];
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(JSON.stringify(payload)));

    const result = await openshellCli.listSandboxes();

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['sandbox', 'list', '-o', 'json'], undefined);
    expect(result).toEqual(payload);
  });

  test('rejects when CLI fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockRejectedValue(new Error('command not found'));

    await expect(openshellCli.listSandboxes()).rejects.toThrow('command not found');
  });
});

describe('startSandbox', () => {
  test('executes openshell sandbox start with name', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.startSandbox('my-sandbox');

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['sandbox', 'start', 'my-sandbox']);
  });

  test('rejects when CLI fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockRejectedValue(new Error('sandbox not found: unknown'));

    await expect(openshellCli.startSandbox('unknown')).rejects.toThrow('sandbox not found: unknown');
  });
});

describe('stopSandbox', () => {
  test('executes openshell sandbox stop with name', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.stopSandbox('my-sandbox');

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['sandbox', 'stop', 'my-sandbox']);
  });

  test('rejects when CLI fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockRejectedValue(new Error('sandbox not found: unknown'));

    await expect(openshellCli.stopSandbox('unknown')).rejects.toThrow('sandbox not found: unknown');
  });
});

describe('deleteSandbox', () => {
  test('executes openshell sandbox delete with name', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.deleteSandbox('my-sandbox');

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['sandbox', 'delete', 'my-sandbox']);
  });

  test('rejects when CLI fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockRejectedValue(new Error('sandbox not found: unknown'));

    await expect(openshellCli.deleteSandbox('unknown')).rejects.toThrow('sandbox not found: unknown');
  });
});

describe('deleteAllSandboxes', () => {
  test('executes openshell sandbox delete --all', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.deleteAllSandboxes();

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['sandbox', 'delete', '--all']);
  });

  test('includes -g flag when gateway is provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.deleteAllSandboxes('my-gw');

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['sandbox', 'delete', '--all', '-g', 'my-gw']);
  });
});

describe('connectSandbox', () => {
  test('executes openshell sandbox connect with name', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.connectSandbox('my-sandbox');

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['sandbox', 'connect', 'my-sandbox']);
  });

  test('rejects when CLI fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockRejectedValue(new Error('sandbox not found: unknown'));

    await expect(openshellCli.connectSandbox('unknown')).rejects.toThrow('sandbox not found: unknown');
  });
});

describe('addGateway', () => {
  test('executes gateway add with endpoint', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.addGateway({ endpoint: 'https://gw.example.com' });

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['gateway', 'add', 'https://gw.example.com']);
  });

  test('includes --name flag when provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.addGateway({ endpoint: 'https://gw.example.com', name: 'my-gw' });

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, [
      'gateway',
      'add',
      'https://gw.example.com',
      '--name',
      'my-gw',
    ]);
  });

  test('includes --remote flag when provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.addGateway({ endpoint: 'https://gw.example.com', remote: 'user@host' });

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, [
      'gateway',
      'add',
      'https://gw.example.com',
      '--remote',
      'user@host',
    ]);
  });

  test('includes --local flag when provided', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.addGateway({ endpoint: 'https://127.0.0.1', local: true });

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['gateway', 'add', 'https://127.0.0.1', '--local']);
  });

  test('extracts JSON error from stdout on failure', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const runError = mockRunError({
      stdout: JSON.stringify({ error: 'invalid endpoint' }),
    });
    vi.mocked(exec.exec).mockRejectedValue(runError);

    await expect(openshellCli.addGateway({ endpoint: 'bad' })).rejects.toThrow('invalid endpoint');
  });
});

describe('removeGateway', () => {
  test('executes gateway remove with name', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.removeGateway('my-gw');

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['gateway', 'remove', 'my-gw']);
  });

  test('executes gateway remove without name for active gateway', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.removeGateway();

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['gateway', 'remove']);
  });
});

describe('selectGateway', () => {
  test('executes gateway select with name', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.selectGateway('my-gw');

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['gateway', 'select', 'my-gw']);
  });

  test('executes gateway select without name', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await openshellCli.selectGateway();

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['gateway', 'select']);
  });
});

describe('listGateways', () => {
  test('executes gateway list with json output and returns parsed result', async () => {
    const payload = [
      { name: 'gw-1', endpoint: 'https://gw1.example.com' },
      { name: 'gw-2', endpoint: 'https://gw2.example.com' },
    ];
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(JSON.stringify(payload)));

    const result = await openshellCli.listGateways();

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['gateway', 'list', '-o', 'json'], undefined);
    expect(result).toEqual(payload);
  });
});

describe('listSandboxesForGateway', () => {
  test('lists sandboxes for a specific gateway using -g flag', async () => {
    const gateways = [
      { name: 'gw-1', endpoint: 'https://gw1.example.com', active: true },
      { name: 'gw-2', endpoint: 'https://gw2.example.com', active: false },
    ];
    const sandboxes = [{ id: 'sb-1', name: 'sb-1', phase: 'Running' }];

    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult(JSON.stringify(gateways)))
      .mockResolvedValueOnce(mockExecResult(JSON.stringify(sandboxes)));

    const result = await openshellCli.listSandboxesForGateway('gw-2');

    expect(result.gateway.name).toBe('gw-2');
    expect(result.sandboxes).toEqual(sandboxes);
    expect(exec.exec).toHaveBeenCalledWith(
      OPENSHELL_CLI_PATH,
      ['sandbox', 'list', '-g', 'gw-2', '-o', 'json'],
      undefined,
    );
    expect(exec.exec).not.toHaveBeenCalledWith(OPENSHELL_CLI_PATH, expect.arrayContaining(['gateway', 'select']));
  });

  test('throws when gateway is not found', async () => {
    const gateways = [{ name: 'gw-1', endpoint: 'https://gw1.example.com', active: true }];
    vi.mocked(exec.exec).mockResolvedValueOnce(mockExecResult(JSON.stringify(gateways)));

    await expect(openshellCli.listSandboxesForGateway('unknown')).rejects.toThrow('Gateway not found: unknown');
  });
});

describe('listSandboxesPerGateway', () => {
  test('returns sandboxes for each gateway using -g flag', async () => {
    const gateways = [
      { name: 'gw-1', endpoint: 'https://gw1.example.com', active: true },
      { name: 'gw-2', endpoint: 'https://gw2.example.com', active: false },
    ];
    const sandboxes1 = [{ id: 'sb-1', name: 'sb-1', phase: 'Running' }];
    const sandboxes2 = [{ id: 'sb-2', name: 'sb-2', phase: 'Stopped' }];

    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult(JSON.stringify(gateways)))
      .mockResolvedValueOnce(mockExecResult(JSON.stringify(sandboxes1)))
      .mockResolvedValueOnce(mockExecResult(JSON.stringify(sandboxes2)));

    const results = await openshellCli.listSandboxesPerGateway();

    expect(results).toHaveLength(2);
    const [first, second] = results;
    expect(first?.gateway.name).toBe('gw-1');
    expect(first?.sandboxes).toEqual(sandboxes1);
    expect(second?.gateway.name).toBe('gw-2');
    expect(second?.sandboxes).toEqual(sandboxes2);
    expect(exec.exec).toHaveBeenCalledWith(
      OPENSHELL_CLI_PATH,
      ['sandbox', 'list', '-g', 'gw-1', '-o', 'json'],
      undefined,
    );
    expect(exec.exec).toHaveBeenCalledWith(
      OPENSHELL_CLI_PATH,
      ['sandbox', 'list', '-g', 'gw-2', '-o', 'json'],
      undefined,
    );
    expect(exec.exec).not.toHaveBeenCalledWith(OPENSHELL_CLI_PATH, expect.arrayContaining(['gateway', 'select']));
  });

  test('returns empty array when no gateways exist', async () => {
    vi.mocked(exec.exec).mockResolvedValueOnce(mockExecResult(JSON.stringify([])));

    const results = await openshellCli.listSandboxesPerGateway();

    expect(results).toEqual([]);
  });

  test('returns empty sandboxes for a gateway that fails to list', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const gateways = [{ name: 'gw-1', endpoint: 'https://gw1.example.com', active: true }];

    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult(JSON.stringify(gateways)))
      .mockRejectedValueOnce(new Error('connection refused'));

    const results = await openshellCli.listSandboxesPerGateway();

    expect(results).toHaveLength(1);
    expect(results.at(0)?.sandboxes).toEqual([]);
  });
});

describe('getGatewayStatus', () => {
  test('executes status and returns trimmed output', async () => {
    const statusText = 'Server Status\n\n  Gateway: openshell\n  Status: Connected\n';
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(statusText));

    const result = await openshellCli.getGatewayStatus();

    expect(exec.exec).toHaveBeenCalledWith(OPENSHELL_CLI_PATH, ['status']);
    expect(result).toBe(statusText.trim());
  });

  test('rejects when no gateway is configured', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockRejectedValue(new Error('no gateway configured'));

    await expect(openshellCli.getGatewayStatus()).rejects.toThrow('no gateway configured');
  });
});
