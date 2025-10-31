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
import { inject, preDestroy } from 'inversify';
import StreamValues from 'stream-json/streamers/StreamValues';

import { type DockerEvent, DockerEventSchema } from '/@/api/connection-event';
import type { EndpointConnection } from '/@/api/endpoint-connection';
import { DockerodeHelper } from '/@/helper/container/dockerode-helper';

// monitor the events on the connections and emit when containers are started or stopped
export class ConnectionHandler {
  @inject(DockerodeHelper)
  private readonly dockerodeHelper: DockerodeHelper;

  #onEvent: EventEmitter<DockerEvent>;
  public readonly onEvent: Event<DockerEvent>;

  #trackedConnections: Set<string> = new Set();

  constructor() {
    this.#onEvent = new EventEmitter<DockerEvent>();
    this.onEvent = this.#onEvent.event;
    this.#trackedConnections = new Set();
  }

  @preDestroy()
  dispose(): void {
    this.#onEvent.dispose();
  }

  monitorConnection(connection: EndpointConnection): void {
    this.#trackedConnections.add(connection.path);
    const eventEmitter = new EventEmitter();
    eventEmitter.event(this.handleDockerEvent.bind(this));

    connection.dockerode.getEvents((err, stream) => {
      if (err) {
        console.error('unable to get events', err);
        this.handleConnectionError(connection);
        return;
      }

      stream?.on('error', error => {
        console.error('/event stream received an error.', error);
        this.handleConnectionError(connection);
      });

      const pipeline = stream?.pipe(StreamValues.withParser());
      pipeline?.on('error', error => {
        console.error('Error while parsing events', error);
      });
      pipeline?.on('data', data => {
        if (data?.value !== undefined) {
          eventEmitter.fire(data.value);
        }
      });
    });
  }

  private handleDockerEvent(jsonEvent: unknown): void {
    // Validate the incoming event against the schema
    const result = DockerEventSchema.safeParse(jsonEvent);
    if (result.success) {
      const dockerEvent = result.data;
      this.#onEvent.fire(dockerEvent);
    } else {
      console.error('Received invalid Docker event:', result.error, jsonEvent);
    }
  }
  unmonitorConnection(path: string): void {
    this.#trackedConnections.delete(path);
  }

  private handleConnectionError(connection: EndpointConnection): void {
    if (this.#trackedConnections.has(connection.path)) {
      setTimeout(() => {
        this.reconnectConnection(connection).catch((error: unknown) => {
          console.error('Error reconnecting to connection:', error);
        });
      }, 5000);
    }
  }

  private async reconnectConnection(connection: EndpointConnection): Promise<void> {
    try {
      const dockerode = await this.dockerodeHelper.getConnection(connection.path);
      connection.dockerode = dockerode;
    } catch (error) {
      console.error(`Error reconnecting to ${connection.path}:`, error);
      // try again in 10 seconds
      setTimeout(() => {
        this.reconnectConnection(connection).catch((error: unknown) => {
          console.error('Error reconnecting to connection:', error);
        });
      }, 10000);
    }
  }
}
