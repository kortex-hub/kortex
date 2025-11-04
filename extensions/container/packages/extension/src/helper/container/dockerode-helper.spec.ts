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

import Dockerode from 'dockerode';
import { beforeEach, expect, test, vi } from 'vitest';

import { DockerodeHelper } from './dockerode-helper';

vi.mock(import('dockerode'));

beforeEach(async () => {
  vi.resetAllMocks();
});

test('getConnection', async () => {
  const dockerodeHelper = new DockerodeHelper();
  const socketPath = '/var/run/docker.sock';

  const fakeDockerodeInstance = {
    ping: vi.fn().mockResolvedValue(true),
  } as unknown as Dockerode;

  // Mock the constructor to return an object with a ping method
  vi.mocked(Dockerode).mockReturnValue(fakeDockerodeInstance);

  const connection = await dockerodeHelper.getConnection(socketPath);
  expect(connection).toBeDefined();
  expect(connection).toBe(fakeDockerodeInstance);

  // Check that Dockerode was called with the correct socketPath
  expect(vi.mocked(Dockerode)).toHaveBeenCalledWith({ socketPath });

  expect(fakeDockerodeInstance.ping).toHaveBeenCalled();
});
