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

import type { Disposable, Event } from '@kortex-app/api';
import { EventEmitter } from '@kortex-app/api';
import type { EndpointConnection } from '@kortex-app/container-extension-api';
import { inject, injectable, preDestroy } from 'inversify';
import StreamValues from 'stream-json/streamers/StreamValues';

import { type DockerEvent, DockerEventSchema } from '/@/api/connection-event';
import { DockerodeHelper } from '/@/helper/container/dockerode-helper';

// monitor the events on the connections and emit when containers are started or stopped
@injectable()
export class ConnectionHandler {
  static readonly RECONNECT_TIMEOUT_MS = 10_000;

  @inject(DockerodeHelper)
  private readonly dockerodeHelper: DockerodeHelper;

  #onEvent: EventEmitter<DockerEvent> = new EventEmitter<DockerEvent>();
  public readonly onEvent: Event<DockerEvent> = this.#onEvent.event;

  #trackedConnections: Set<string> = new Set();
  #connectionDisposables: Map<string, Disposable[]> = new Map();

  @preDestroy()
  dispose(): void {
    this.#onEvent.dispose();
    // Dispose all per-connection resources
    for (const disposables of this.#connectionDisposables.values()) {
      disposables.forEach(d => d.dispose());
    }
    this.#trackedConnections.clear();
    this.#connectionDisposables.clear();
  }

  monitorConnection(connection: EndpointConnection): void {
    // Clean up existing monitoring for this path
    const existingDisposables = this.#connectionDisposables.get(connection.path);
    if (existingDisposables) {
      existingDisposables.forEach(d => d.dispose());
    }
    const disposables: Disposable[] = [];
    this.#connectionDisposables.set(connection.path, disposables);
    this.#trackedConnections.add(connection.path);
    const eventEmitter = new EventEmitter();
    disposables.push(eventEmitter);
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
    const disposables = this.#connectionDisposables.get(path);
    if (disposables) {
      disposables.forEach(d => d.dispose());
      this.#connectionDisposables.delete(path);
    }
  }

  private handleConnectionError(connection: EndpointConnection): void {
    if (this.#trackedConnections.has(connection.path)) {
      setTimeout(() => {
        this.reconnectConnection(connection).catch((error: unknown) => {
          console.error('Error reconnecting to connection:', error);
        });
      }, ConnectionHandler.RECONNECT_TIMEOUT_MS);
    }
  }

  private async reconnectConnection(connection: EndpointConnection): Promise<void> {
    try {
      const dockerode = await this.dockerodeHelper.getConnection(connection.path);
      connection.dockerode = dockerode;
      this.monitorConnection(connection);
    } catch (error) {
      console.error(`Error reconnecting to ${connection.path}:`, error);
      // try again
      setTimeout(() => {
        this.reconnectConnection(connection).catch((error: unknown) => {
          console.error('Error reconnecting to connection:', error);
        });
      }, ConnectionHandler.RECONNECT_TIMEOUT_MS);
    }
  }

  protected getTrackedConnections(): Set<string> {
    return this.#trackedConnections;
  }
}
