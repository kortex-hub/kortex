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

import { injectable } from 'inversify';

export interface CronComponents {
  minute: string;
  hour: string;
  day: string;
  month: string;
  weekday: string;
}

@injectable()
export class CronParser {
  parse(cronExpression: string): CronComponents {
    const parts = cronExpression.trim().split(/\s+/);
    return {
      minute: parts[0] ?? '*',
      hour: parts[1] ?? '*',
      day: parts[2] ?? '*',
      month: parts[3] ?? '*',
      weekday: parts[4] ?? '*',
    };
  }

  toCronExpression(components: CronComponents): string {
    return [components.minute, components.hour, components.day, components.month, components.weekday].join(' ');
  }
}
