/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import type { RunResult } from '@kortex-app/api';
import { process } from '@kortex-app/api';
import { beforeEach, expect, test, vi } from 'vitest';

import { PodmanSocketMacOSFinder } from './podman-macos-finder';

vi.mock(import('node:fs'));
vi.mock(import('node:os'));
vi.mock(import('node:path'));
vi.mock(import('@kortex-app/api'));

beforeEach(() => {
  vi.resetAllMocks();
});

test('findPaths returns empty array when socket does not exist', async () => {
  const finder = new PodmanSocketMacOSFinder();

  vi.mocked(homedir).mockReturnValue('/home/user');
  vi.mocked(resolve).mockReturnValue('/home/user/.local/share/containers/podman/machine/podman.sock');
  vi.mocked(existsSync).mockReturnValue(false);

  const result = await finder.findPaths();

  expect(result).toEqual([]);
  expect(existsSync).toHaveBeenCalledWith('/home/user/.local/share/containers/podman/machine/podman.sock');
  expect(process.exec).not.toHaveBeenCalled();
});

test('findPaths returns socket path when socket exists and machine is running', async () => {
  const finder = new PodmanSocketMacOSFinder();

  const socketPath = '/home/user/.local/share/containers/podman/machine/podman.sock';
  vi.mocked(homedir).mockReturnValue('/home/user');
  vi.mocked(resolve).mockReturnValue(socketPath);
  vi.mocked(existsSync).mockReturnValue(true);

  const machineListOutput = JSON.stringify([{ Name: 'podman-machine-default', VMType: 'qemu', Running: true }]);

  vi.mocked(process.exec).mockResolvedValue({ stdout: machineListOutput, stderr: '' } as RunResult);

  const result = await finder.findPaths();

  expect(result).toEqual([socketPath]);
  expect(process.exec).toHaveBeenCalledWith('podman', ['machine', 'ls', '--all-providers', '--format', 'json']);
});

test('findPaths returns empty array when socket exists but no machines are running', async () => {
  const finder = new PodmanSocketMacOSFinder();

  const socketPath = '/home/user/.local/share/containers/podman/machine/podman.sock';
  vi.mocked(homedir).mockReturnValue('/home/user');
  vi.mocked(resolve).mockReturnValue(socketPath);
  vi.mocked(existsSync).mockReturnValue(true);

  const machineListOutput = JSON.stringify([{ Name: 'podman-machine-default', VMType: 'qemu', Running: false }]);

  vi.mocked(process.exec).mockResolvedValue({ stdout: machineListOutput, stderr: '' } as RunResult);

  const result = await finder.findPaths();

  expect(result).toEqual([]);
});

test('findPaths returns socket path when multiple machines exist and at least one is running', async () => {
  const finder = new PodmanSocketMacOSFinder();

  const socketPath = '/home/user/.local/share/containers/podman/machine/podman.sock';
  vi.mocked(homedir).mockReturnValue('/home/user');
  vi.mocked(resolve).mockReturnValue(socketPath);
  vi.mocked(existsSync).mockReturnValue(true);

  const machineListOutput = JSON.stringify([
    { Name: 'podman-machine-1', VMType: 'qemu', Running: false },
    { Name: 'podman-machine-2', VMType: 'qemu', Running: true },
    { Name: 'podman-machine-3', VMType: 'qemu', Running: false },
  ]);

  vi.mocked(process.exec).mockResolvedValue({ stdout: machineListOutput, stderr: '' } as RunResult);

  const result = await finder.findPaths();

  expect(result).toEqual([socketPath]);
});

test('findPaths returns empty array when socket exists but machine list is empty', async () => {
  const finder = new PodmanSocketMacOSFinder();

  const socketPath = '/home/user/.local/share/containers/podman/machine/podman.sock';
  vi.mocked(homedir).mockReturnValue('/home/user');
  vi.mocked(resolve).mockReturnValue(socketPath);
  vi.mocked(existsSync).mockReturnValue(true);

  const machineListOutput = JSON.stringify([]);

  vi.mocked(process.exec).mockResolvedValue({ stdout: machineListOutput, stderr: '' } as RunResult);

  const result = await finder.findPaths();

  expect(result).toEqual([]);
});
