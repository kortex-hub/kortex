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

import { beforeEach, expect, test, vi } from 'vitest';

import { CronXmlParser } from './cron-xml-parser';

let cronXmlParser: CronXmlParser;

beforeEach(async () => {
  vi.resetAllMocks();
  cronXmlParser = new CronXmlParser();
});

test('extracts interval-based trigger with 5 minute interval', () => {
  const xml = `
    <Task>
      <Triggers>
        <TimeTrigger>
          <Repetition>
            <Interval>PT5M</Interval>
          </Repetition>
        </TimeTrigger>
      </Triggers>
    </Task>
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('*/5 * * * *');
});

test('extracts interval-based trigger with 15 minute interval', () => {
  const xml = `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <Repetition>
            <Interval>PT15M</Interval>
          </Repetition>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('*/15 * * * *');
});

test('extracts daily schedule at specific time', () => {
  const xml = `
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
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('30 14 * * *');
});

test('extracts daily schedule with multiple day intervals', () => {
  const xml = `
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
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('00 09 */3 * *');
});

test('extracts weekly schedule with single weekday', () => {
  const xml = `
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
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('15 10 * * 1');
});

test('extracts weekly schedule with multiple weekdays', () => {
  const xml = `
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
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('45 08 * * 1,3,5');
});

test('extracts weekly schedule with all weekdays', () => {
  const xml = `
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
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('00 12 * * 0,1,2,3,4,5,6');
});

test('extracts monthly schedule with single day', () => {
  const xml = `
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
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('20 16 1 * *');
});

test('extracts monthly schedule with multiple days', () => {
  const xml = `
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
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('30 07 1,15,30 * *');
});

test('defaults to midnight when no time specified', () => {
  const xml = `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <ScheduleByDay>
            <DaysInterval>1</DaysInterval>
          </ScheduleByDay>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('0 0 * * *');
});

test('handles zero-padded time values', () => {
  const xml = `
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
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('05 03 * * *');
});

test('handles evening times correctly', () => {
  const xml = `
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
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('59 23 * * *');
});

test('prioritizes interval trigger over calendar trigger', () => {
  const xml = `
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
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('*/10 * * * *');
});

test('handles empty DaysOfWeek with wildcard', () => {
  const xml = `
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
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('00 06 * * *');
});

test('handles empty DaysOfMonth with wildcard', () => {
  const xml = `
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
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('15 13 * * *');
});

test('returns fallback when no schedule type is found', () => {
  const xml = `
    <Task>
      <Triggers>
        <CalendarTrigger>
          <StartBoundary>2025-01-15T17:45:00</StartBoundary>
        </CalendarTrigger>
      </Triggers>
    </Task>
  `;

  const result = cronXmlParser.extractFromXml(xml);

  expect(result).toBe('45 17 * * *');
});
