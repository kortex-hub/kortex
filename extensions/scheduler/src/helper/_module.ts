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

import { CronParser } from '/@/helper/cron-parser';
import { ExecutionParser } from '/@/helper/execution-parser';
import { macOSHelpersModule } from '/@/helper/macos/_module';
import { windowsHelpersModule } from '/@/helper/windows/_module';

const helpersModule = new ContainerModule(async options => {
  // Reuse bindings
  if (env.isMac) {
    await macOSHelpersModule.load(options);
  } else if (env.isWindows) {
    await windowsHelpersModule.load(options);
  }

  options.bind<CronParser>(CronParser).toSelf().inSingletonScope();
  options.bind<ExecutionParser>(ExecutionParser).toSelf().inSingletonScope();
});

export { helpersModule };
