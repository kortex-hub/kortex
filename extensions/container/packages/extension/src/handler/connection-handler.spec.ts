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

import * as kortexApi from '@kortex-app/api';
import type { EndpointConnection } from '@kortex-app/container-extension-api';
import type Dockerode from 'dockerode';
import { Container } from 'inversify';
import { beforeEach, expect, test, vi } from 'vitest';

import { DockerodeHelper } from '/@/helper/container/dockerode-helper';

import { ConnectionHandler } from './connection-handler';

vi.mock(import('dockerode'));

const dockerodeHelperMock = {
  getConnection: vi.fn(),
} as unknown as DockerodeHelper;

class TestConnectionHandler extends ConnectionHandler {
  public getTrackedConnections(): Set<string> {
    return super.getTrackedConnections();
  }
}

let connectionHandler: TestConnectionHandler;

beforeEach(async () => {
  vi.resetAllMocks();
  const api = kortexApi as unknown as { init: () => void };
  api.init();
  const container = new Container();
  container.bind(TestConnectionHandler).toSelf().inSingletonScope();
  container.bind(DockerodeHelper).toConstantValue(dockerodeHelperMock);
  connectionHandler = await container.getAsync<TestConnectionHandler>(TestConnectionHandler);
});

test('should initialize with empty tracked connections', () => {
  expect(connectionHandler.getTrackedConnections().size).toBe(0);
});

test('should add connection to tracked connections when monitoring', () => {
  const mockDockerode = {
    getEvents: vi.fn(),
  } as unknown as Dockerode;

  const connection: EndpointConnection = {
    path: '/var/run/docker.sock',
    dockerode: mockDockerode,
  } as EndpointConnection;

  connectionHandler.monitorConnection(connection);

  expect(connectionHandler.getTrackedConnections().has(connection.path)).toBe(true);
  expect(mockDockerode.getEvents).toHaveBeenCalled();
});

test('should handle error when getting events', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const mockError = new Error('Failed to get events');
  const mockDockerode = {
    getEvents: vi.fn(callback => callback(mockError, null)),
  } as unknown as Dockerode;

  const connection: EndpointConnection = {
    path: '/var/run/docker.sock',
    dockerode: mockDockerode,
  } as EndpointConnection;

  connectionHandler.monitorConnection(connection);

  expect(consoleErrorSpy).toHaveBeenCalledWith('unable to get events', mockError);
  consoleErrorSpy.mockRestore();
});
