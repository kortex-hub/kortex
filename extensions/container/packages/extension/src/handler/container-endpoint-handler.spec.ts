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
import Dockerode from 'dockerode';
import { Container, injectFromBase } from 'inversify';
import { beforeEach, expect, test, vi } from 'vitest';

import { DockerEvent } from '/@/api/connection-event';
import { SocketFinder } from '/@/api/socket-finder';
import { ContainerEndpointHandler } from '/@/handler/container-endpoint-handler';
import { DockerodeHelper } from '/@/helper/container/dockerode-helper';

import { ConnectionHandler } from './connection-handler';

vi.mock(import('dockerode'));

const dockerodeHelperMock = {
  getConnection: vi.fn(),
} as unknown as DockerodeHelper;

const socketFinderMock = {
  findPaths: vi.fn(),
} as unknown as SocketFinder;

const connectionHandlerMock: ConnectionHandler = {
  onEvent: vi.fn(),
  monitorConnection: vi.fn(),
  unmonitorConnection: vi.fn(),
} as unknown as ConnectionHandler;

const mockDockerode = {} as unknown as Dockerode;

@injectFromBase()
class TestContainerEndpointHandler extends ContainerEndpointHandler {
  public updateAvailableSockets(): Promise<void> {
    return super.updateAvailableSockets();
  }
}

let containerEndpointHandler: TestContainerEndpointHandler;

beforeEach(async () => {
  vi.resetAllMocks();
  const api = kortexApi as unknown as { init: () => void };
  api.init();
  const container = new Container();
  container.bind(TestContainerEndpointHandler).toSelf().inSingletonScope();
  container.bind(DockerodeHelper).toConstantValue(dockerodeHelperMock);
  container.bind(SocketFinder).toConstantValue(socketFinderMock);
  container.bind(ConnectionHandler).toConstantValue(connectionHandlerMock);
  containerEndpointHandler = await container.getAsync<TestContainerEndpointHandler>(TestContainerEndpointHandler);
});

test('should initialize without errors', async () => {
  await containerEndpointHandler.init();

  expect(connectionHandlerMock.onEvent).toHaveBeenCalled();
});

test('should update available sockets on init', async () => {
  const mockPath = '/var/run/docker.sock';
  vi.mocked(socketFinderMock.findPaths).mockResolvedValue([mockPath]);
  vi.mocked(dockerodeHelperMock.getConnection).mockResolvedValue(mockDockerode);

  await containerEndpointHandler.init();

  expect(socketFinderMock.findPaths).toHaveBeenCalled();
  expect(dockerodeHelperMock.getConnection).toHaveBeenCalledWith(mockPath);
});

test('should return empty endpoints initially', () => {
  const endpoints = containerEndpointHandler.getEndpoints();

  expect(endpoints).toEqual([]);
});

test('should add new endpoints when sockets are found', async () => {
  const mockPath = '/var/run/docker.sock';
  vi.mocked(socketFinderMock.findPaths).mockResolvedValue([mockPath]);
  vi.mocked(dockerodeHelperMock.getConnection).mockResolvedValue(mockDockerode);

  await containerEndpointHandler.init();

  const endpoints = containerEndpointHandler.getEndpoints();
  expect(endpoints).toHaveLength(1);
  expect(endpoints[0].path).toBe(mockPath);
  expect(endpoints[0].dockerode).toBe(mockDockerode);
});

test('should monitor new connections', async () => {
  const mockPath = '/var/run/docker.sock';
  vi.mocked(socketFinderMock.findPaths).mockResolvedValue([mockPath]);
  vi.mocked(dockerodeHelperMock.getConnection).mockResolvedValue(mockDockerode);
  connectionHandlerMock.monitorConnection = vi.fn();

  await containerEndpointHandler.init();

  expect(connectionHandlerMock.monitorConnection).toHaveBeenCalledWith({ path: mockPath, dockerode: mockDockerode });
});

test('should fire onEndpointsChanged when endpoints are added', async () => {
  const mockPath = '/var/run/docker.sock';
  vi.mocked(socketFinderMock.findPaths).mockResolvedValue([mockPath]);
  vi.mocked(dockerodeHelperMock.getConnection).mockResolvedValue(mockDockerode);

  const listener = vi.fn();
  containerEndpointHandler.onEndpointsChanged(listener);

  await containerEndpointHandler.init();

  await vi.waitFor(() => expect(listener).toHaveBeenCalledWith([{ path: mockPath, dockerode: mockDockerode }]));
});

test('should dispose event emitters on dispose', () => {
  containerEndpointHandler.dispose();

  // Verify no errors are thrown
  expect(true).toBe(true);
});

test('should clear interval on dispose', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  await containerEndpointHandler.init();

  containerEndpointHandler.dispose();

  vi.advanceTimersByTime(30_000);

  expect(socketFinderMock.findPaths).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});

// test onEvent with container event
test('should fire onContainersChanged when a container event is received', async () => {
  const dockerEvent = { Type: 'container' } as unknown as DockerEvent;

  const listener = vi.fn();
  containerEndpointHandler.onContainersChanged(listener);

  await containerEndpointHandler.init();

  // Simulate receiving a Docker event
  const onEventCallback = vi.mocked(connectionHandlerMock.onEvent).mock.calls[0]?.[0];
  expect(onEventCallback).toBeDefined();

  onEventCallback?.(dockerEvent);

  expect(listener).toHaveBeenCalled();
});

// check the setInterval calls updateAvailableSockets every 30 seconds
test('should call updateAvailableSockets every 30 seconds', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const updateSpy = vi.spyOn(containerEndpointHandler, 'updateAvailableSockets');

  await containerEndpointHandler.init();

  expect(updateSpy).toHaveBeenCalledTimes(1); // called once on init

  vi.advanceTimersByTime(30_000);
  expect(updateSpy).toHaveBeenCalledTimes(2);

  vi.advanceTimersByTime(30_000);
  expect(updateSpy).toHaveBeenCalledTimes(3);

  containerEndpointHandler.dispose();
  vi.useRealTimers();
});

// in case of error in updateAvailableSockets, it should be caught and logged
test('should handle errors in updateAvailableSockets gracefully', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const consoleErrorSpy = vi.spyOn(console, 'error');
  const spyUpdateAvailableSockets = vi.spyOn(containerEndpointHandler, 'updateAvailableSockets');

  // first call works fine
  // next one throws error
  spyUpdateAvailableSockets.mockResolvedValueOnce().mockRejectedValue(new Error('Test error'));

  await containerEndpointHandler.init();

  vi.advanceTimersByTime(40_000);

  // wait the next tick to ensure the setInterval callback has executed
  await vi.waitFor(() => expect(spyUpdateAvailableSockets).toHaveBeenCalledTimes(2));

  expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating available sockets:', expect.any(Error));

  containerEndpointHandler.dispose();
  vi.useRealTimers();
  spyUpdateAvailableSockets.mockRestore();
  consoleErrorSpy.mockRestore();
});
