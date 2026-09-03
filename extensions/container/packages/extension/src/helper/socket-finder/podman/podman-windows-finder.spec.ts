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

import type { RunResult } from '@openkaiden/api';
import { process } from '@openkaiden/api';
import { Container } from 'inversify';
import { beforeEach, expect, test, vi } from 'vitest';

import { PodmanVersionDetector } from './podman-version-detector';
import { PodmanSocketWindowsFinder } from './podman-windows-finder';

vi.mock(import('@openkaiden/api'));

const versionDetectorMock = {
  getMajorVersion: vi.fn(),
} as unknown as PodmanVersionDetector;

let finder: PodmanSocketWindowsFinder;

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(versionDetectorMock.getMajorVersion).mockResolvedValue(5);

  const container = new Container();
  container.bind(PodmanSocketWindowsFinder).toSelf().inSingletonScope();
  container.bind(PodmanVersionDetector).toConstantValue(versionDetectorMock);
  finder = await container.getAsync(PodmanSocketWindowsFinder);
});

test('findPaths returns empty array when socket does not exist', async () => {
  const machineListOutput = JSON.stringify([]);

  vi.mocked(process.exec).mockResolvedValue({ stdout: machineListOutput, stderr: '' } as RunResult);

  const result = await finder.findPaths();

  expect(result).toEqual([]);
  expect(process.exec).toHaveBeenCalledWith('podman.exe', ['machine', 'ls', '--all-providers', '--format', 'json']);
});

test('findPaths returns socket path with --all-providers on podman 5', async () => {
  vi.mocked(versionDetectorMock.getMajorVersion).mockResolvedValue(5);

  const machineListOutput = JSON.stringify([{ Name: 'podman-machine-default', VMType: 'qemu', Running: true }]);

  vi.mocked(process.exec).mockResolvedValue({ stdout: machineListOutput, stderr: '' } as RunResult);

  const result = await finder.findPaths();

  expect(result).toEqual(['\\\\.\\pipe\\podman-machine-default']);
  expect(process.exec).toHaveBeenCalledWith('podman.exe', ['machine', 'ls', '--all-providers', '--format', 'json']);
});

test('findPaths returns socket path without --all-providers on podman 6', async () => {
  vi.mocked(versionDetectorMock.getMajorVersion).mockResolvedValue(6);

  const machineListOutput = JSON.stringify([{ Name: 'podman-machine-default', VMType: 'qemu', Running: true }]);

  vi.mocked(process.exec).mockResolvedValue({ stdout: machineListOutput, stderr: '' } as RunResult);

  const result = await finder.findPaths();

  expect(result).toEqual(['\\\\.\\pipe\\podman-machine-default']);
  expect(process.exec).toHaveBeenCalledWith('podman.exe', ['machine', 'ls', '--format', 'json']);
});

test('findPaths returns empty array when socket exists but no machines are running', async () => {
  const machineListOutput = JSON.stringify([{ Name: 'podman-machine-default', VMType: 'qemu', Running: false }]);

  vi.mocked(process.exec).mockResolvedValue({ stdout: machineListOutput, stderr: '' } as RunResult);

  const result = await finder.findPaths();

  expect(result).toEqual([]);
});

test('findPaths returns socket path when multiple machines exist and at least one is running', async () => {
  const machineListOutput = JSON.stringify([
    { Name: 'machine-1', VMType: 'qemu', Running: false },
    { Name: 'machine-2', VMType: 'qemu', Running: true },
    { Name: 'machine-3', VMType: 'qemu', Running: false },
  ]);

  vi.mocked(process.exec).mockResolvedValue({ stdout: machineListOutput, stderr: '' } as RunResult);

  const result = await finder.findPaths();

  expect(result).toEqual(['\\\\.\\pipe\\podman-machine-2']);
});

test('findPaths returns empty array when socket exists but machine list is empty', async () => {
  const machineListOutput = JSON.stringify([]);

  vi.mocked(process.exec).mockResolvedValue({ stdout: machineListOutput, stderr: '' } as RunResult);

  const result = await finder.findPaths();

  expect(result).toEqual([]);
});
