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
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { RunResult } from '@openkaiden/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import type { Directories } from '/@/plugin/directories.js';
import type { OpenshellCli } from '/@/plugin/openshell-cli/openshell-cli.js';
import type { Exec } from '/@/plugin/util/exec.js';
import type { CliToolInfo } from '/@api/cli-tool-info.js';
import type { GatewayInfo } from '/@api/openshell-gateway-info.js';

import { OpenshellGateway } from './openshell-gateway.js';

vi.mock(import('node:child_process'));
vi.mock(import('node:fs/promises'));
vi.mock(import('/@/plugin/util/exec.js'));

const { spawn } = await import('node:child_process');

const GATEWAY_BINARY = '/usr/local/bin/openshell-gateway';
const KAIDEN_DATA_DIRECTORY = '/home/user/.local/share/kaiden';
const GATEWAY_STORAGE_DIRECTORY = join(KAIDEN_DATA_DIRECTORY, 'openshell-gateway');
const GATEWAY_CONFIG_PATH = join(GATEWAY_STORAGE_DIRECTORY, 'gateway.toml');

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
  return { command: GATEWAY_BINARY, stdout, stderr: '' };
}

let gateway: OpenshellGateway;

const cliToolRegistry = {
  getCliToolInfos: vi.fn(),
} as unknown as CliToolRegistry;

const openshellCli = {
  listGateways: vi.fn(),
  selectGateway: vi.fn(),
  checkEndpointStatus: vi.fn(),
  addGateway: vi.fn(),
} as unknown as OpenshellCli;

const directories = {
  getDataDirectory: vi.fn().mockReturnValue(KAIDEN_DATA_DIRECTORY),
} as unknown as Directories;

const exec = {
  exec: vi.fn(),
} as unknown as Exec;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(directories.getDataDirectory).mockReturnValue(KAIDEN_DATA_DIRECTORY);
  vi.mocked(cliToolRegistry.getCliToolInfos).mockReturnValue([
    { name: 'openshell-gateway', path: GATEWAY_BINARY },
  ] as unknown as CliToolInfo[]);
  vi.mocked(exec.exec).mockResolvedValue({ command: '', stdout: '', stderr: '' });
  gateway = new OpenshellGateway(cliToolRegistry, openshellCli, directories, exec);
});

describe('init', () => {
  test('skips auto-start when existing gateway is healthy and already active', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const existingGateways: GatewayInfo[] = [
      { name: 'local-gw', endpoint: 'https://127.0.0.1:8443', active: true, type: 'local' },
    ];
    vi.mocked(openshellCli.listGateways).mockResolvedValue(existingGateways);
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    await gateway.init();

    expect(openshellCli.listGateways).toHaveBeenCalled();
    expect(openshellCli.checkEndpointStatus).toHaveBeenCalledWith('https://127.0.0.1:8443');
    expect(spawn).not.toHaveBeenCalled();
    expect(openshellCli.selectGateway).not.toHaveBeenCalled();
  });

  test('selects healthy gateway when it is not active', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const existingGateways: GatewayInfo[] = [{ name: 'kaiden-alt', endpoint: 'http://127.0.0.1:18080', active: false }];
    vi.mocked(openshellCli.listGateways).mockResolvedValue(existingGateways);
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

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
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValueOnce(false).mockResolvedValue(true);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));

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
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    await gateway.init();

    expect(spawn).not.toHaveBeenCalled();
    expect(openshellCli.addGateway).toHaveBeenCalledWith({
      endpoint: 'http://127.0.0.1:17670',
      local: true,
      name: 'kaiden-local',
    });
  });

  test('skips auto-start when discovery fails and binary is not registered', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(openshellCli.listGateways).mockRejectedValue(new Error('CLI not found'));
    vi.mocked(cliToolRegistry.getCliToolInfos).mockReturnValue([] as unknown as CliToolInfo[]);

    await gateway.init();

    expect(spawn).not.toHaveBeenCalled();
  });

  test('auto-starts when discovery fails but binary is available and port is free', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(openshellCli.listGateways).mockRejectedValue(new Error('no gateway configured'));
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValueOnce(false).mockResolvedValue(true);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));

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
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

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
    vi.mocked(openshellCli.checkEndpointStatus)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));

    await gateway.init();

    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      expect.arrayContaining(['--port', '17670']),
      expect.objectContaining({ detached: false }),
    );
  });

  test('delegates health check to openshellCli for https endpoints', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const gateways: GatewayInfo[] = [
      { name: 'tls-gw', endpoint: 'https://127.0.0.1:8443', active: true, type: 'local' },
    ];
    vi.mocked(openshellCli.listGateways).mockResolvedValue(gateways);
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    await gateway.init();

    expect(openshellCli.checkEndpointStatus).toHaveBeenCalledWith('https://127.0.0.1:8443');
  });

  test('skips remote gateways during init and auto-starts local', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const gateways: GatewayInfo[] = [{ name: 'remote-gw', endpoint: 'https://gw.example.com', active: true }];
    vi.mocked(openshellCli.listGateways).mockResolvedValue(gateways);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValueOnce(false).mockResolvedValue(true);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));

    await gateway.init();

    expect(openshellCli.checkEndpointStatus).not.toHaveBeenCalledWith('https://gw.example.com');
    expect(spawn).toHaveBeenCalled();
  });
});

describe('getGatewayBinaryPath', () => {
  test('returns path from CLI tool registry', () => {
    expect(gateway.getGatewayBinaryPath()).toBe(GATEWAY_BINARY);
  });

  test('returns undefined when openshell-gateway is not registered', () => {
    vi.mocked(cliToolRegistry.getCliToolInfos).mockReturnValue([] as unknown as CliToolInfo[]);
    expect(gateway.getGatewayBinaryPath()).toBeUndefined();
  });
});

describe('start', () => {
  test('spawns the gateway process with default args including config', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    await gateway.start();

    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      ['--config', GATEWAY_CONFIG_PATH, '--port', '17670', '--bind-address', '127.0.0.1', '--disable-tls'],
      expect.objectContaining({ detached: false }),
    );
  });

  test('spawns with custom port and address', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    await gateway.start({ port: 9999, bindAddress: '0.0.0.0' });

    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      ['--config', GATEWAY_CONFIG_PATH, '--port', '9999', '--bind-address', '0.0.0.0', '--disable-tls'],
      expect.objectContaining({ detached: false }),
    );
  });

  test('skips --disable-tls when disableTls is false', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    await gateway.start({ disableTls: false });

    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      ['--config', GATEWAY_CONFIG_PATH, '--port', '17670', '--bind-address', '127.0.0.1'],
      expect.objectContaining({ detached: false }),
    );
  });

  test('skips if already running', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    await gateway.start();
    await gateway.start();

    expect(spawn).toHaveBeenCalledTimes(1);
  });

  test('throws when gateway binary is not registered', async () => {
    vi.mocked(cliToolRegistry.getCliToolInfos).mockReturnValue([] as unknown as CliToolInfo[]);

    await expect(gateway.start()).rejects.toThrow('openshell-gateway binary not registered');
  });

  test('performs health check via openshellCli', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    await gateway.start();

    expect(openshellCli.checkEndpointStatus).toHaveBeenCalledWith('http://127.0.0.1:17670');
  });

  test('registers gateway via openshellCli after health check passes', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    await gateway.start();

    expect(openshellCli.addGateway).toHaveBeenCalledWith({
      endpoint: 'http://127.0.0.1:17670',
      local: true,
      name: 'kaiden-local',
    });
  });

  test('skips registerWithCli when skipRegistration is true', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    await gateway.start({ skipRegistration: true });

    expect(spawn).toHaveBeenCalled();
    expect(openshellCli.addGateway).not.toHaveBeenCalled();
  });

  test('generates certs by calling the gateway binary with generate-certs', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    await gateway.start();

    expect(mkdir).toHaveBeenCalledWith(GATEWAY_STORAGE_DIRECTORY, { recursive: true });
    expect(exec.exec).toHaveBeenCalledWith(GATEWAY_BINARY, [
      'generate-certs',
      '--server-san',
      '127.0.0.1',
      '--server-san',
      'localhost',
      '--server-san',
      'host.openshell.internal',
      '--output-dir',
      GATEWAY_STORAGE_DIRECTORY,
    ]);
  });

  test('writes gateway.toml config with JWT paths', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    await gateway.start();

    expect(writeFile).toHaveBeenCalledWith(
      GATEWAY_CONFIG_PATH,
      expect.stringContaining('[openshell.gateway.gateway_jwt]'),
      'utf-8',
    );
    expect(writeFile).toHaveBeenCalledWith(GATEWAY_CONFIG_PATH, expect.stringContaining('signing_key_path'), 'utf-8');
    expect(writeFile).toHaveBeenCalledWith(GATEWAY_CONFIG_PATH, expect.stringContaining('public_key_path'), 'utf-8');
    expect(writeFile).toHaveBeenCalledWith(GATEWAY_CONFIG_PATH, expect.stringContaining('kid_path'), 'utf-8');
  });

  test('starts gateway without --config when cert generation fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);
    vi.mocked(exec.exec).mockRejectedValue(new Error('generate-certs failed'));

    await gateway.start();

    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      ['--port', '17670', '--bind-address', '127.0.0.1', '--disable-tls'],
      expect.objectContaining({ detached: false }),
    );
  });

  test('stops the spawned process when waitForReady fails', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec).mockRejectedValue(new Error('command not found'));
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(false);

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
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

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
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    await gateway.start();

    expect(gateway.isRunning()).toBe(true);
  });
});

describe('dispose', () => {
  test('stops the gateway process', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    await gateway.start();

    gateway.dispose();

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });
});

describe('onDidGatewayStart', () => {
  test('fires when existing gateway is healthy and active', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(openshellCli.listGateways).mockResolvedValue([
      { name: 'local-gw', endpoint: 'https://127.0.0.1:8443', active: true, type: 'local' },
    ]);
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    const listener = vi.fn();
    gateway.onDidGatewayStart(listener);
    await gateway.init();

    expect(listener).toHaveBeenCalledOnce();
  });

  test('fires when existing gateway is healthy but not active', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(openshellCli.listGateways).mockResolvedValue([
      { name: 'kaiden-alt', endpoint: 'http://127.0.0.1:18080', active: false },
    ]);
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    const listener = vi.fn();
    gateway.onDidGatewayStart(listener);
    await gateway.init();

    expect(listener).toHaveBeenCalledOnce();
  });

  test('fires when orphan gateway found on default port', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(openshellCli.listGateways).mockResolvedValue([]);
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);

    const listener = vi.fn();
    gateway.onDidGatewayStart(listener);
    await gateway.init();

    expect(listener).toHaveBeenCalledOnce();
  });

  test('fires when auto-start succeeds', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(openshellCli.listGateways).mockResolvedValue([]);
    const proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValueOnce(false).mockResolvedValue(true);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));

    const listener = vi.fn();
    gateway.onDidGatewayStart(listener);
    await gateway.init();

    expect(listener).toHaveBeenCalledOnce();
  });

  test('does not fire when no binary and no gateways', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(openshellCli.listGateways).mockRejectedValue(new Error('CLI not found'));
    vi.mocked(cliToolRegistry.getCliToolInfos).mockReturnValue([] as unknown as CliToolInfo[]);

    const listener = vi.fn();
    gateway.onDidGatewayStart(listener);
    await gateway.init();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('gateway config generation', () => {
  let proc: ReturnType<typeof createMockChildProcess>;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    proc = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    vi.mocked(openshellCli.checkEndpointStatus).mockResolvedValue(true);
  });

  test('writes gateway config under the kaiden data directory', async () => {
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));

    await gateway.start();

    expect(mkdir).toHaveBeenCalledWith(GATEWAY_STORAGE_DIRECTORY, { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(
      GATEWAY_CONFIG_PATH,
      expect.stringContaining('[openshell.drivers.podman]'),
      'utf-8',
    );
  });

  test('config only includes podman driver section', async () => {
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));

    await gateway.start();

    const writtenContent = vi.mocked(writeFile).mock.calls[0]?.[1] as string;
    expect(writtenContent).toContain('[openshell.drivers.podman]');
    expect(writtenContent).not.toContain('[openshell.drivers.docker]');
  });

  test('pins supervisor image to detected gateway version', async () => {
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));

    await gateway.start();

    expect(exec.exec).toHaveBeenCalledWith(GATEWAY_BINARY, ['--version']);
    expect(writeFile).toHaveBeenCalledWith(
      GATEWAY_CONFIG_PATH,
      expect.stringContaining('supervisor_image = "ghcr.io/nvidia/openshell/supervisor:0.0.69"'),
      'utf-8',
    );
  });

  test('passes --config flag to spawned gateway process', async () => {
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));

    await gateway.start();

    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      expect.arrayContaining(['--config', GATEWAY_CONFIG_PATH]),
      expect.objectContaining({ detached: false }),
    );
  });

  test('uses custom supervisorImage without version detection', async () => {
    await gateway.start({ supervisorImage: 'my-registry.io/supervisor:custom' });

    expect(exec.exec).not.toHaveBeenCalledWith(GATEWAY_BINARY, ['--version']);
    expect(writeFile).toHaveBeenCalledWith(
      GATEWAY_CONFIG_PATH,
      expect.stringContaining('supervisor_image = "my-registry.io/supervisor:custom"'),
      'utf-8',
    );
  });

  test('still generates config when version detection fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockRejectedValueOnce(new Error('command not found'));

    await gateway.start();

    expect(writeFile).toHaveBeenCalledWith(
      GATEWAY_CONFIG_PATH,
      expect.not.stringContaining('supervisor_image'),
      'utf-8',
    );
    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      expect.arrayContaining(['--config', GATEWAY_CONFIG_PATH]),
      expect.objectContaining({ detached: false }),
    );
  });

  test('still generates config when version output is unparseable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('unknown-format'));

    await gateway.start();

    expect(writeFile).toHaveBeenCalledWith(
      GATEWAY_CONFIG_PATH,
      expect.not.stringContaining('supervisor_image'),
      'utf-8',
    );
  });

  test('starts without --config when writeFile fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(mockExecResult('openshell-gateway 0.0.69'));
    vi.mocked(writeFile).mockRejectedValueOnce(new Error('permission denied'));

    await gateway.start();

    expect(spawn).toHaveBeenCalledWith(
      GATEWAY_BINARY,
      ['--port', '17670', '--bind-address', '127.0.0.1', '--disable-tls'],
      expect.objectContaining({ detached: false }),
    );
  });
});
