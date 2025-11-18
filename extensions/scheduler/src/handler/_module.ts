/**********************************************************************
 * Copyright (C) 2025-2026 Red Hat, Inc.
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

import { NativeScheduler } from '/@/api/native-scheduler-api';
import { LaunchAgentScheduler } from '/@/handler/launch-agent-scheduler';
import { SchtasksScheduler } from '/@/handler/schtaks-scheduler';

const handlersModule = new ContainerModule(options => {
  if (env.isMac) {
    options.bind<LaunchAgentScheduler>(LaunchAgentScheduler).toSelf().inSingletonScope();
    options.bind<NativeScheduler>(NativeScheduler).toService(LaunchAgentScheduler);
  }
  if (env.isWindows) {
    options.bind<SchtasksScheduler>(SchtasksScheduler).toSelf().inSingletonScope();
    options.bind<NativeScheduler>(NativeScheduler).toService(SchtasksScheduler);
  }
});

export { handlersModule };
