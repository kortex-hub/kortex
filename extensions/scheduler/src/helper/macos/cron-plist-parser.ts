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

import { inject, injectable } from 'inversify';

import { CronParser } from '/@/helper/cron-parser';

@injectable()
export class CronPListParser {
  @inject(CronParser)
  private readonly cronParser: CronParser;

  extractFromPlist(plistContent: string): string {
    const minuteRegex = /<key>Minute<\/key>\s*<integer>(\d+)<\/integer>/;
    const hourRegex = /<key>Hour<\/key>\s*<integer>(\d+)<\/integer>/;
    const dayRegex = /<key>Day<\/key>\s*<integer>(\d+)<\/integer>/;
    const monthRegex = /<key>Month<\/key>\s*<integer>(\d+)<\/integer>/;
    const weekdayRegex = /<key>Weekday<\/key>\s*<integer>(\d+)<\/integer>/;

    const minuteMatch = minuteRegex.exec(plistContent);
    const hourMatch = hourRegex.exec(plistContent);
    const dayMatch = dayRegex.exec(plistContent);
    const monthMatch = monthRegex.exec(plistContent);
    const weekdayMatch = weekdayRegex.exec(plistContent);

    return this.cronParser.toCronExpression({
      minute: minuteMatch?.[1] ?? '*',
      hour: hourMatch?.[1] ?? '*',
      day: dayMatch?.[1] ?? '*',
      month: monthMatch?.[1] ?? '*',
      weekday: weekdayMatch?.[1] ?? '*',
    });
  }
}
