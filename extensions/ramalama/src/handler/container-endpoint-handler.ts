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

import type { Event } from '@kortex-app/api';
import { EventEmitter } from '@kortex-app/api';
import { inject, multiInject, preDestroy } from 'inversify';

import type { DockerEvent } from '/@/api/connection-event';
import type { EndpointConnection } from '/@/api/endpoint-connection';
import { SocketFinder } from '/@/api/socket-finder';
import { ConnectionHandler } from '/@/handler/conection-handler';
import { DockerodeHelper } from '/@/helper/container/dockerode-helper';

// this class is responsible for managing the endpoints of the containers
// it has connections to the socketPath and can query the endpoints
export class ContainerEndpointHandler {
  // SocketFinders to find all possible socket paths
  @multiInject(SocketFinder)
  private readonly socketFinders: SocketFinder[];

  @inject(DockerodeHelper)
  private readonly dockerodeHelper: DockerodeHelper;

  @inject(ConnectionHandler)
  private readonly connectionHandler: ConnectionHandler;

  // EventEmitter to notify when endpoints change
  #onEndpointsChanged: EventEmitter<EndpointConnection[]>;
  public readonly onEndpointsChanged: Event<EndpointConnection[]>;

  // EventEmitter to notify when containers are started or stopped
  #onContainersChanged: EventEmitter<void>;
  public readonly onContainersChanged: Event<void>;

  // instance of Dockerode for each socket path
  #endpoints: Map<string, EndpointConnection> = new Map();

  #interval: NodeJS.Timeout | null = null;

  constructor() {
    this.#onEndpointsChanged = new EventEmitter<EndpointConnection[]>();
    this.onEndpointsChanged = this.#onEndpointsChanged.event;

    this.#onContainersChanged = new EventEmitter<void>();
    this.onContainersChanged = this.#onContainersChanged.event;
  }

  @preDestroy()
  dispose(): void {
    this.#onEndpointsChanged.dispose();
    this.#onContainersChanged.dispose();
    if (this.#interval) {
      clearInterval(this.#interval);
    }
  }

  async init(): Promise<void> {
    this.connectionHandler.onEvent((dockerEvent: DockerEvent) => {
      if (dockerEvent.Type === 'container') {
        this.#onContainersChanged.fire();
      }
    });

    await this.updateAvailableSockets();

    // run updateAvailableSockets() every 30 seconds
    this.#interval = setInterval(() => {
      this.updateAvailableSockets().catch((error: unknown) => {
        console.error('Error updating available sockets:', error);
      });
    }, 30000);
  }

  protected async updateAvailableSockets(): Promise<void> {
    console.log('socketFinders', this.socketFinders);
    // get all possible socket paths
    const foundPaths = await Promise.all(this.socketFinders.map(finder => finder.findPaths()));
    const paths = foundPaths.flat();

    console.log('Found socket paths:', paths);

    // compare with existing endpoints
    const existingPaths = Array.from(this.#endpoints.keys());

    let updated = false;

    // add new paths
    for (const path of paths) {
      if (!this.#endpoints.has(path)) {
        try {
          const dockerode = await this.dockerodeHelper.getConnection(path);

          console.log(`Connected to socket ${path}`);
          const connection = { path, dockerode };

          this.connectionHandler.monitorConnection(connection);

          this.#endpoints.set(path, connection);
          updated = true;
        } catch (error) {
          console.error(`Error connecting to socket ${path}:`, error);
        }
      }
    }

    // remove old paths
    for (const path of existingPaths) {
      if (!paths.includes(path)) {
        updated = true;
        this.connectionHandler.unmonitorConnection(path);
        this.#endpoints.delete(path);
      }
    }

    if (updated) {
      // notify listeners with the new list of endpoints
      this.#onEndpointsChanged.fire(Array.from(this.#endpoints.values()));
    }
  }
}
