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

import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import type { RunResult } from '@openkaiden/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import type { OpenshellCli } from '/@/plugin/openshell-cli/openshell-cli.js';
import type { Proxy } from '/@/plugin/proxy.js';
import { Exec } from '/@/plugin/util/exec.js';
import type { CliToolInfo } from '/@api/cli-tool-info.js';
import type { GatewayInfo } from '/@api/openshell-gateway-info.js';

import { OpenshellGateway } from './openshell-gateway.js';

vi.mock(import('node:child_process'));
vi.mock(import('node:fs/promises'));
vi.mock(import('node:os'));
vi.mock(import('/@/plugin/util/exec.js'));

const { spawn } = await import('node:child_process');

const GATEWAY_BINARY = '/usr/local/bin/openshell-gateway';
const CLI_BINARY = '/usr/local/bin/openshell';

function createMockChildProcess(): ChildProcess & { _stdout: EventEmitter; _stderr: EventEmitter } {
  const proc = new EventEmitter() as ChildProcess & { _stdout: EventEmitter; _stderr: EventEmitter };
  proc._stdout = new EventEmitter();
  proc._stderr = new EventEmitter();
  Object.defineProperty(proc, 'stdout', { get: (): EventEmitter => proc._stdout });
  Object.defineProperty(proc, 'stderr', { get: (): EventEmitter => proc._stderr });
  proc.kill = vi.fn().mockReturnValue(true);
  return proc;
}

function mockExecResult(stdout = ''): RunResult {
  return { command: CLI_BINARY, stdout, stderr: '' };
}

let gateway: OpenshellGateway;

const exec = new Exec({} as Proxy);
const cliToolRegistry = {
  getCliToolInfos: vi.fn(),
} as unknown as CliToolRegistry;

const openshellCli = {
  listGateways: vi.fn(),
  selectGateway: vi.fn(),
} as unknown as OpenshellCli;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(cliToolRegistry.getCliToolInfos).mockReturnValue([
    { name: 'openshell-gateway', path: GATEWAY_BINARY },
    { name: 'openshell', path: CLI_BINARY },
  ] as unknown as CliToolInfo[]);
  vi.mocked(tmpdir).mockReturnValue('/tmp');
  gateway = new OpenshellGateway(exec, cliToolRegistry, openshellCli);
});

describe('init', () => {
  test('skips auto-start when existing gateway is healthy and already active', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const existingGateways: GatewayInfo[] = [
      { name: 'local-gw', endpoint: 'https://127.0.0.1:8443', active: true, type: 'local' },
    ];
    vi.mocked(openshellCli.listGateways).mockResolvedValue(existingGateways);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await gateway.init();

    expect(openshellCli.listGateways).toHaveBeenCalled();
    expect(exec.exec).toHaveBeenCalledWith(CLI_BINARY, ['status', '--gateway-endpoint', 'https://127.0.0.1:8443']);
    expect(spawn).not.toHaveBeenCalled();
    expect(openshellCli.selectGateway).not.toHaveBeenCalled();
  });

  test('selects healthy gateway when it is not active', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const existingGateways: GatewayInfo[] = [{ name: 'kaiden-alt', endpoint: 'http://127.0.0.1:18080', active: false }];
    vi.mocked(openshellCli.listGateways).mockResolvedValue(existingGateways);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await gateway.init();

    expect(openshellCli.selectGateway).toHaveBeenCalledWith('kaiden-alt');
    expect(spawn).not.toHaveBeenCalled();
  });

  test('auto-starts local gateway when no gateways exist and port is free', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(openshellCli.listGateways).mockResolvedValue([]);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult(''));

    await gateway.init();

    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      expect.arrayContaining(['--port', '17670']),
      expect.objectContaining({ detached: false }),
    );
  });

  test('reuses orphan gateway when port is already healthy', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(openshellCli.listGateways).mockResolvedValue([]);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await gateway.init();

    expect(spawn).not.toHaveBeenCalled();
    expect(exec.exec).toHaveBeenCalledWith(CLI_BINARY, [
      'gateway',
      'add',
      'http://127.0.0.1:17670',
      '--local',
      '--name',
      'kaiden-local',
    ]);
  });

  test('skips auto-start when discovery fails and binary is not registered', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(openshellCli.listGateways).mockRejectedValue(new Error('CLI not found'));
    vi.mocked(cliToolRegistry.getCliToolInfos).mockReturnValue([
      { name: 'openshell', path: CLI_BINARY },
    ] as unknown as CliToolInfo[]);

    await gateway.init();

    expect(spawn).not.toHaveBeenCalled();
  });

  test('auto-starts when discovery fails but binary is available and port is free', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(openshellCli.listGateways).mockRejectedValue(new Error('no gateway configured'));
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult(''));

    await gateway.init();

    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      expect.arrayContaining(['--port', '17670']),
      expect.objectContaining({ detached: false }),
    );
  });

  test('returns without spawning when at least one gateway is healthy among multiple', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const gateways: GatewayInfo[] = [
      { name: 'gw-stopped', endpoint: 'http://127.0.0.1:8080', active: false },
      { name: 'gw-healthy', endpoint: 'http://127.0.0.1:9090', active: true },
    ];
    vi.mocked(openshellCli.listGateways).mockResolvedValue(gateways);
    vi.mocked(exec.exec)
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce(mockExecResult(''));

    await gateway.init();

    expect(spawn).not.toHaveBeenCalled();
  });

  test('creates new gateway when existing gateways are unreachable', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const gateways: GatewayInfo[] = [{ name: 'broken-gw', endpoint: 'http://127.0.0.1:19999', active: true }];
    vi.mocked(openshellCli.listGateways).mockResolvedValue(gateways);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult(''));

    await gateway.init();

    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      expect.arrayContaining(['--port', '17670']),
      expect.objectContaining({ detached: false }),
    );
  });

  test('does not pass --gateway-insecure for https endpoints during health check', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const gateways: GatewayInfo[] = [
      { name: 'tls-gw', endpoint: 'https://127.0.0.1:8443', active: true, type: 'local' },
    ];
    vi.mocked(openshellCli.listGateways).mockResolvedValue(gateways);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await gateway.init();

    expect(exec.exec).toHaveBeenCalledWith(CLI_BINARY, ['status', '--gateway-endpoint', 'https://127.0.0.1:8443']);
  });

  test('skips remote gateways during init and auto-starts local', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const gateways: GatewayInfo[] = [{ name: 'remote-gw', endpoint: 'https://gw.example.com', active: true }];
    vi.mocked(openshellCli.listGateways).mockResolvedValue(gateways);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult(''));

    await gateway.init();

    expect(exec.exec).not.toHaveBeenCalledWith(
      CLI_BINARY,
      expect.arrayContaining(['--gateway-endpoint', 'https://gw.example.com']),
    );
    expect(spawn).toHaveBeenCalled();
  });
});

describe('getGatewayBinaryPath', () => {
  test('returns path from CLI tool registry', () => {
    expect(gateway.getGatewayBinaryPath()).toBe(GATEWAY_BINARY);
  });

  test('returns undefined when openshell-gateway is not registered', () => {
    vi.mocked(cliToolRegistry.getCliToolInfos).mockReturnValue([
      { name: 'openshell', path: CLI_BINARY },
    ] as unknown as CliToolInfo[]);
    expect(gateway.getGatewayBinaryPath()).toBeUndefined();
  });
});

describe('start', () => {
  test('spawns the gateway process with default args', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult('connected'));

    await gateway.start();

    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      ['--config', '/tmp/kaiden-gateway.toml', '--port', '17670', '--bind-address', '127.0.0.1', '--disable-tls'],
      expect.objectContaining({ detached: false }),
    );
  });

  test('spawns with custom port and address', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult('connected'));

    await gateway.start({ port: 9999, bindAddress: '0.0.0.0' });

    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      ['--config', '/tmp/kaiden-gateway.toml', '--port', '9999', '--bind-address', '0.0.0.0', '--disable-tls'],
      expect.objectContaining({ detached: false }),
    );
  });

  test('skips --disable-tls when disableTls is false', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult('connected'));

    await gateway.start({ disableTls: false });

    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      ['--config', '/tmp/kaiden-gateway.toml', '--port', '17670', '--bind-address', '127.0.0.1'],
      expect.objectContaining({ detached: false }),
    );
  });

  test('skips if already running', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult('connected'));

    await gateway.start();
    await gateway.start();

    expect(spawn).toHaveBeenCalledTimes(1);
  });

  test('throws when gateway binary is not registered', async () => {
    vi.mocked(cliToolRegistry.getCliToolInfos).mockReturnValue([
      { name: 'openshell', path: CLI_BINARY },
    ] as unknown as CliToolInfo[]);

    await expect(gateway.start()).rejects.toThrow('openshell-gateway binary not registered');
  });

  test('performs health check with openshell status', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult(''));

    await gateway.start();

    expect(exec.exec).toHaveBeenCalledWith(CLI_BINARY, [
      'status',
      '--gateway-endpoint',
      'http://127.0.0.1:17670',
      '--gateway-insecure',
    ]);
  });

  test('registers gateway with CLI after health check passes', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult(''));

    await gateway.start();

    expect(exec.exec).toHaveBeenCalledWith(CLI_BINARY, [
      'gateway',
      'add',
      'http://127.0.0.1:17670',
      '--local',
      '--name',
      'kaiden-local',
    ]);
  });

  test('skips registerWithCli when skipRegistration is true', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult(''));

    await gateway.start({ skipRegistration: true });

    expect(spawn).toHaveBeenCalled();
    expect(exec.exec).not.toHaveBeenCalledWith(CLI_BINARY, expect.arrayContaining(['gateway', 'add']));
  });

  test('stops the spawned process when waitForReady fails', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec).mockRejectedValue(new Error('connection refused'));

    let caughtError: unknown;
    const startPromise = gateway.start().catch((err: unknown) => {
      caughtError = err;
    });

    for (let i = 0; i < 30; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }

    proc.emit('exit', 1, undefined);
    await vi.advanceTimersByTimeAsync(5000);
    await startPromise;

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toContain('Gateway did not become ready');
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    vi.useRealTimers();
  });
});

describe('stop', () => {
  test('sends SIGTERM to running process', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult(''));

    await gateway.start();

    const stopPromise = gateway.stop();
    proc.emit('exit', 0, undefined);
    await stopPromise;

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  test('is a no-op when not running', async () => {
    await gateway.stop();
  });
});

describe('isRunning', () => {
  test('returns false when no process is spawned', () => {
    expect(gateway.isRunning()).toBe(false);
  });

  test('returns true when process is running', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult(''));

    await gateway.start();

    expect(gateway.isRunning()).toBe(true);
  });
});

describe('dispose', () => {
  test('stops the gateway process', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult(''));

    await gateway.start();

    gateway.dispose();

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });
});

describe('supervisor image pinning', () => {
  test('writes config file pinning supervisor image to gateway version', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult(''));

    await gateway.start();

    expect(exec.exec).toHaveBeenCalledWith(GATEWAY_BINARY, ['--version']);
    expect(writeFile).toHaveBeenCalledWith(
      '/tmp/kaiden-gateway.toml',
      '[openshell.drivers.podman]\nsupervisor_image = "ghcr.io/nvidia/openshell/supervisor:0.0.69"\n',
      'utf-8',
    );
  });

  test('config only includes podman driver section', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult(''));

    await gateway.start();

    const writtenContent = vi.mocked(writeFile).mock.calls[0]?.[1] as string;
    expect(writtenContent).toContain('[openshell.drivers.podman]');
    expect(writtenContent).not.toContain('[openshell.drivers.docker]');
  });

  test('passes --config flag to spawned gateway process', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec)
      .mockResolvedValueOnce(mockExecResult('openshell-gateway 0.0.69'))
      .mockResolvedValue(mockExecResult(''));

    await gateway.start();

    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      expect.arrayContaining(['--config', '/tmp/kaiden-gateway.toml']),
      expect.objectContaining({ detached: false }),
    );
  });

  test('uses custom supervisorImage without version detection', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult(''));

    await gateway.start({ supervisorImage: 'my-registry.io/supervisor:custom' });

    expect(exec.exec).not.toHaveBeenCalledWith(GATEWAY_BINARY, ['--version']);
    expect(writeFile).toHaveBeenCalledWith(
      '/tmp/kaiden-gateway.toml',
      '[openshell.drivers.podman]\nsupervisor_image = "my-registry.io/supervisor:custom"\n',
      'utf-8',
    );
  });

  test('starts without --config when version detection fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec).mockRejectedValueOnce(new Error('command not found')).mockResolvedValue(mockExecResult(''));

    await gateway.start();

    expect(writeFile).not.toHaveBeenCalled();
    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      ['--port', '17670', '--bind-address', '127.0.0.1', '--disable-tls'],
      expect.objectContaining({ detached: false }),
    );
  });

  test('starts without --config when version output is unparseable', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec).mockResolvedValueOnce(mockExecResult('unknown-format')).mockResolvedValue(mockExecResult(''));

    await gateway.start();

    expect(writeFile).not.toHaveBeenCalled();
    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      ['--port', '17670', '--bind-address', '127.0.0.1', '--disable-tls'],
      expect.objectContaining({ detached: false }),
    );
  });
});
