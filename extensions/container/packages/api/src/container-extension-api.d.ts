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
import type Dockerode from 'dockerode';

export interface ContainerEngineEvent {
  status?: string;
  Type?: string;
}

export interface EndpointConnection {
  path: string;
  dockerode: Dockerode;
}

export interface ContainerExtensionAPI {
  // notify when endpoints change
  readonly onEndpointsChanged: Event<readonly EndpointConnection[]>;

  // notify when containers are started or stopped
  readonly onContainersChanged: Event<void>;

  getEndpoints(): readonly EndpointConnection[];
}
