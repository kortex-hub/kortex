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

@injectable()
export class CronXmlParser {
  /**
   * Extract cron expression from Windows Task Scheduler XML content
   */
  extractFromXml(xmlContent: string): string {
    // Check for simple interval trigger (e.g., */5 * * * *)
    const intervalMatch = RegExp(/<Interval>PT(\d+)M<\/Interval>/s).exec(xmlContent);
    if (intervalMatch) {
      const minutes = intervalMatch[1];
      return `*/${minutes} * * * *`;
    }

    // Extract schedule details from CalendarTrigger
    const scheduleByDayMatch = RegExp(/<ScheduleByDay>.*?<DaysInterval>(\d+)<\/DaysInterval>/s).exec(xmlContent);
    const scheduleByWeekMatch = RegExp(/<ScheduleByWeek>.*?<DaysOfWeek>(.*?)<\/DaysOfWeek>/s).exec(xmlContent);
    const scheduleByMonthMatch = RegExp(/<ScheduleByMonth>.*?<DaysOfMonth>(.*?)<\/DaysOfMonth>/s).exec(xmlContent);

    // Extract time from StartBoundary
    const timeMatch = RegExp(/<StartBoundary>\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):\d{2}<\/StartBoundary>/).exec(
      xmlContent,
    );
    const minute = timeMatch ? timeMatch[2] : '0';
    const hour = timeMatch ? timeMatch[1] : '0';

    // Build cron expression based on schedule type
    if (scheduleByWeekMatch) {
      // Weekly schedule - extract days of week
      const daysContent = scheduleByWeekMatch[1];
      const weekdayMap: Record<string, string> = {
        Sunday: '0',
        Monday: '1',
        Tuesday: '2',
        Wednesday: '3',
        Thursday: '4',
        Friday: '5',
        Saturday: '6',
      };

      const weekdays: string[] = [];
      for (const [day, value] of Object.entries(weekdayMap)) {
        if (daysContent.includes(`<${day}`)) {
          weekdays.push(value);
        }
      }

      const weekdayStr = weekdays.length > 0 ? weekdays.join(',') : '*';
      return `${minute} ${hour} * * ${weekdayStr}`;
    }

    if (scheduleByMonthMatch) {
      // Monthly schedule - extract days
      const daysContent = scheduleByMonthMatch[1];
      const dayMatches = [...daysContent.matchAll(/<Day>(\d+)<\/Day>/g)];
      const days = dayMatches.map(m => m[1]);
      const dayStr = days.length > 0 ? days.join(',') : '*';
      return `${minute} ${hour} ${dayStr} * *`;
    }

    if (scheduleByDayMatch) {
      // Daily schedule
      const daysInterval = scheduleByDayMatch[1];
      if (daysInterval === '1') {
        return `${minute} ${hour} * * *`;
      }
      // For intervals > 1, approximate with day of month pattern
      return `${minute} ${hour} */${daysInterval} * *`;
    }

    // Default fallback
    return `${minute} ${hour} * * *`;
  }
}
