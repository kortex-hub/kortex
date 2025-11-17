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

export interface CronXmlTestCase {
  description: string;
  xml: string;
  expected: string;
}

export const cronXmlTestCases: CronXmlTestCase[] = [
  {
    description: 'interval trigger with 5 minute interval',
    xml: `
    <Task>
      <Triggers>
        <TimeTrigger>
          <Repetition>
            <Interval>PT5M</Interval>
          </Repetition>
        </TimeTrigger>
      </Triggers>
    </Task>
  `,
    expected: '*/5 * * * *',
  },
  {
    description: 'interval trigger with 15 minute interval',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <Repetition>
            <Interval>PT15M</Interval>
          </Repetition>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '*/15 * * * *',
  },
  {
    description: 'daily schedule at specific time',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <StartBoundary>2025-01-15T14:30:00</StartBoundary>
          <ScheduleByDay>
            <DaysInterval>1</DaysInterval>
          </ScheduleByDay>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '30 14 * * *',
  },
  {
    description: 'daily schedule with multiple day intervals',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <StartBoundary>2025-01-15T09:00:00</StartBoundary>
          <ScheduleByDay>
            <DaysInterval>3</DaysInterval>
          </ScheduleByDay>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '00 09 */3 * *',
  },
  {
    description: 'weekly schedule with single weekday',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <StartBoundary>2025-01-15T10:15:00</StartBoundary>
          <ScheduleByWeek>
            <DaysOfWeek>
              <Monday />
            </DaysOfWeek>
            <WeeksInterval>1</WeeksInterval>
          </ScheduleByWeek>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '15 10 * * 1',
  },
  {
    description: 'weekly schedule with multiple weekdays',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <StartBoundary>2025-01-15T08:45:00</StartBoundary>
          <ScheduleByWeek>
            <DaysOfWeek>
              <Monday />
              <Wednesday />
              <Friday />
            </DaysOfWeek>
            <WeeksInterval>1</WeeksInterval>
          </ScheduleByWeek>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '45 08 * * 1,3,5',
  },
  {
    description: 'weekly schedule with all weekdays',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <StartBoundary>2025-01-15T12:00:00</StartBoundary>
          <ScheduleByWeek>
            <DaysOfWeek>
              <Sunday />
              <Monday />
              <Tuesday />
              <Wednesday />
              <Thursday />
              <Friday />
              <Saturday />
            </DaysOfWeek>
            <WeeksInterval>1</WeeksInterval>
          </ScheduleByWeek>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '00 12 * * 0,1,2,3,4,5,6',
  },
  {
    description: 'monthly schedule with single day',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <StartBoundary>2025-01-15T16:20:00</StartBoundary>
          <ScheduleByMonth>
            <DaysOfMonth>
              <Day>1</Day>
            </DaysOfMonth>
            <Months>
              <January />
            </Months>
          </ScheduleByMonth>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '20 16 1 * *',
  },
  {
    description: 'monthly schedule with multiple days',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <StartBoundary>2025-01-15T07:30:00</StartBoundary>
          <ScheduleByMonth>
            <DaysOfMonth>
              <Day>1</Day>
              <Day>15</Day>
              <Day>30</Day>
            </DaysOfMonth>
          </ScheduleByMonth>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '30 07 1,15,30 * *',
  },
  {
    description: 'defaults to midnight when no time specified',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <ScheduleByDay>
            <DaysInterval>1</DaysInterval>
          </ScheduleByDay>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '0 0 * * *',
  },
  {
    description: 'zero-padded time values',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <StartBoundary>2025-01-15T03:05:00</StartBoundary>
          <ScheduleByDay>
            <DaysInterval>1</DaysInterval>
          </ScheduleByDay>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '05 03 * * *',
  },
  {
    description: 'evening times correctly',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <StartBoundary>2025-01-15T23:59:00</StartBoundary>
          <ScheduleByDay>
            <DaysInterval>1</DaysInterval>
          </ScheduleByDay>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '59 23 * * *',
  },
  {
    description: 'prioritizes interval trigger over calendar trigger',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <StartBoundary>2025-01-15T10:00:00</StartBoundary>
          <Repetition>
            <Interval>PT10M</Interval>
          </Repetition>
          <ScheduleByDay>
            <DaysInterval>1</DaysInterval>
          </ScheduleByDay>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '*/10 * * * *',
  },
  {
    description: 'empty DaysOfWeek with wildcard',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <StartBoundary>2025-01-15T06:00:00</StartBoundary>
          <ScheduleByWeek>
            <DaysOfWeek>
            </DaysOfWeek>
            <WeeksInterval>1</WeeksInterval>
          </ScheduleByWeek>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '00 06 * * *',
  },
  {
    description: 'empty DaysOfMonth with wildcard',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <StartBoundary>2025-01-15T13:15:00</StartBoundary>
          <ScheduleByMonth>
            <DaysOfMonth>
            </DaysOfMonth>
          </ScheduleByMonth>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '15 13 * * *',
  },
  {
    description: 'fallback when no schedule type found',
    xml: `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <StartBoundary>2025-01-15T17:45:00</StartBoundary>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `,
    expected: '45 17 * * *',
  },
];
