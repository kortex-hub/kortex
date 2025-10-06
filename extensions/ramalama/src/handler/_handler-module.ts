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

import { ContainerModule } from 'inversify';

import { ConnectionHandler } from './conection-handler';
import { ContainerEndpointHandler } from './container-endpoint-handler';
import { ModelsHandler } from './models-handler';

const handlersModule = new ContainerModule(options => {
  options.bind<ContainerEndpointHandler>(ContainerEndpointHandler).toSelf().inSingletonScope();
  options.bind<ModelsHandler>(ModelsHandler).toSelf().inSingletonScope();
  options.bind<ConnectionHandler>(ConnectionHandler).toSelf().inSingletonScope();
});

export { handlersModule };
