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

import { Event, EventEmitter } from '@kortex-app/api';
import { inject, preDestroy } from 'inversify';

import type { EndpointConnection } from '/@/api/endpoint-connection';
import type { ModelInfo } from '/@/api/model-info';
import { ContainerEndpointHandler } from '/@/handler/container-endpoint-handler';
import { ContainerModelExtractor } from '/@/helper/container/container-model-extractor';
import { ContainerRamaLamaFinder } from '/@/helper/container/container-ramalama-finder';

export class ModelsHandler {
  @inject(ContainerRamaLamaFinder)
  private containerRamaLamaFinder: ContainerRamaLamaFinder;

  @inject(ContainerModelExtractor)
  private containerModelExtractor: ContainerModelExtractor;

  @inject(ContainerEndpointHandler)
  private containerEndpointHandler: ContainerEndpointHandler;

  #connections: EndpointConnection[] = [];

  #models: ModelInfo[] = [];

  // EventEmitter to notify when models change
  #onModelsChanged: EventEmitter<ModelInfo[]>;
  public readonly onModelsChanged: Event<ModelInfo[]>;

  constructor() {
    this.#onModelsChanged = new EventEmitter<ModelInfo[]>();
    this.onModelsChanged = this.#onModelsChanged.event;
  }

  @preDestroy()
  dispose(): void {
    this.#onModelsChanged.dispose();
  }

  async init(): Promise<void> {
    // subscribe to the event
    this.containerEndpointHandler.onEndpointsChanged(dockerodeConnections => {
      this.#connections = dockerodeConnections;
      this.refreshModels().catch((error: unknown) => {
        console.error('Error refreshing models:', error);
      });
    });

    this.containerEndpointHandler.onContainersChanged(() => {
      this.refreshModels().catch((error: unknown) => {
        console.error('Error refreshing models:', error);
      });
    });

    await this.containerEndpointHandler.init();
  }

  async refreshModels(): Promise<void> {
    const foundModels: ModelInfo[] = [];
    for (const connection of this.#connections) {
      try {
        // get the RamaLama containers
        const containers = await connection.dockerode.listContainers();

        // filter the containers to only include RamaLama ones
        const ramaLamaContainers = await this.containerRamaLamaFinder.getRamaLamaContainers(containers);

        // if we found any RamaLama containers, return them
        if (ramaLamaContainers.length > 0) {
          // call ContainerModelExtractor to extract model info from each container
          const models = await Promise.all(
            ramaLamaContainers.map(async container => {
              return this.containerModelExtractor.extractModelInfo(container);
            }),
          );
          foundModels.push(...models);
        }
      } catch (error) {
        console.error(`Error connecting to socket ${connection.path}:`, error);
      }
    }

    // update models
    this.#models = foundModels;

    // notify listeners
    this.#onModelsChanged.fire(this.#models);
  }
}
