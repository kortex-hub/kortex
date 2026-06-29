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
import { env, process } from '@openkaiden/api';
import { beforeEach, expect, test, vi } from 'vitest';

import { PodmanVersionDetector } from './podman-version-detector';

vi.mock(import('@openkaiden/api'));

beforeEach(() => {
  vi.resetAllMocks();
});

test('getMajorVersion returns 5 for podman 5.x', async () => {
  const detector = new PodmanVersionDetector();

  vi.mocked(env).isWindows = false;
  vi.mocked(process.exec).mockResolvedValue({ stdout: 'podman version 5.3.1', stderr: '' } as RunResult);

  const version = await detector.getMajorVersion();

  expect(version).toBe(5);
  expect(process.exec).toHaveBeenCalledWith('podman', ['--version']);
});

test('getMajorVersion returns 6 for podman 6.x', async () => {
  const detector = new PodmanVersionDetector();

  vi.mocked(env).isWindows = false;
  vi.mocked(process.exec).mockResolvedValue({ stdout: 'podman version 6.0.0', stderr: '' } as RunResult);

  const version = await detector.getMajorVersion();

  expect(version).toBe(6);
});

test('getMajorVersion uses podman.exe on Windows', async () => {
  const detector = new PodmanVersionDetector();

  vi.mocked(env).isWindows = true;
  vi.mocked(process.exec).mockResolvedValue({ stdout: 'podman version 5.2.0', stderr: '' } as RunResult);

  const version = await detector.getMajorVersion();

  expect(version).toBe(5);
  expect(process.exec).toHaveBeenCalledWith('podman.exe', ['--version']);
});

test('getMajorVersion defaults to 6 when exec fails', async () => {
  const detector = new PodmanVersionDetector();

  vi.mocked(env).isWindows = false;
  vi.mocked(process.exec).mockRejectedValue(new Error('podman not found'));

  const version = await detector.getMajorVersion();

  expect(version).toBe(6);
});

test('getMajorVersion defaults to 6 when output cannot be parsed', async () => {
  const detector = new PodmanVersionDetector();

  vi.mocked(env).isWindows = false;
  vi.mocked(process.exec).mockResolvedValue({ stdout: 'unexpected output', stderr: '' } as RunResult);

  const version = await detector.getMajorVersion();

  expect(version).toBe(6);
});

test('getMajorVersion caches the result', async () => {
  const detector = new PodmanVersionDetector();

  vi.mocked(env).isWindows = false;
  vi.mocked(process.exec).mockResolvedValue({ stdout: 'podman version 5.3.1', stderr: '' } as RunResult);

  await detector.getMajorVersion();
  const version = await detector.getMajorVersion();

  expect(version).toBe(5);
  expect(process.exec).toHaveBeenCalledTimes(1);
});
