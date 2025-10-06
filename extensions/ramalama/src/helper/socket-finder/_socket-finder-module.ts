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

import { env } from '@kortex-app/api';
import { ContainerModule } from 'inversify';

import { SocketFinder } from '/@/api/socket-finder';

import { DockerSocketMacOSFinder } from './docker/docker-macos-finder';
import { PodmanSocketMacOSFinder } from './podman/podman-macos-finder';
import { PodmanSocketWindowsFinder } from './podman/podman-windows-finder';

const socketFinderModule = new ContainerModule(options => {
  if (env.isMac) {
    options.bind<PodmanSocketMacOSFinder>(PodmanSocketMacOSFinder).toSelf().inSingletonScope();
    options.bind<DockerSocketMacOSFinder>(DockerSocketMacOSFinder).toSelf().inSingletonScope();
    options.bind<SocketFinder>(SocketFinder).toService(PodmanSocketMacOSFinder);
    options.bind<SocketFinder>(SocketFinder).toService(DockerSocketMacOSFinder);
  } else if (env.isWindows) {
    options.bind<PodmanSocketWindowsFinder>(PodmanSocketWindowsFinder).toSelf().inSingletonScope();
    options.bind<SocketFinder>(SocketFinder).toService(PodmanSocketWindowsFinder);
  }
});

export { socketFinderModule };
