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

import { process } from '@kortex-app/api';
import { beforeEach, expect, test, vi } from 'vitest';

import { DockerSocketMacOSFinder } from '/@/helper/socket-finder/docker/docker-macos-finder';

vi.mock(import('node:fs'));
vi.mock(import('node:os'));
vi.mock(import('node:path'));
vi.mock(import('@kortex-app/api'));

beforeEach(() => {
  vi.resetAllMocks();
});

test('findPaths returns empty array when socket does not exist', async () => {
  const finder = new DockerSocketMacOSFinder();
  const socketPath = '/home/user/.docker/run/docker.sock';

  vi.mocked(homedir).mockReturnValue('/home/user');
  vi.mocked(resolve).mockReturnValue(socketPath);
  vi.mocked(existsSync).mockReturnValue(false);

  const result = await finder.findPaths();

  expect(result).toEqual([]);
  expect(existsSync).toHaveBeenCalledWith(socketPath);
  expect(process.exec).not.toHaveBeenCalled();
});

test('findPaths returns socket path when socket exists', async () => {
  const finder = new DockerSocketMacOSFinder();

  const socketPath = '/home/user/.docker/run/docker.sock';
  vi.mocked(homedir).mockReturnValue('/home/user');
  vi.mocked(resolve).mockReturnValue(socketPath);
  vi.mocked(existsSync).mockReturnValue(true);

  const result = await finder.findPaths();

  expect(result).toEqual([socketPath]);
});
