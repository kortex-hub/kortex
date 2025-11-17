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

import { SchtasksXmlGenerator } from './schtasks-xml-generator';

let schtasksXmlGenerator: SchtasksXmlGenerator;

beforeEach(async () => {
  vi.resetAllMocks();
  schtasksXmlGenerator = new SchtasksXmlGenerator();
});

test('generates TimeTrigger for */5 minute interval', () => {
  const xml = schtasksXmlGenerator.generate({
    id: 'job-interval',
    metadata: {},
    executorScript: 'C:\\scripts\\executor.ps1',
    storageDir: 'C:\\storage',
    command: { command: 'echo', args: ['hello'], env: {} },
    outputFile: 'C:\\logs\\job.log',
    cronComponents: { minute: '*/5', hour: '*', day: '*', month: '*', weekday: '*' },
  });

  expect(xml).toContain('<TimeTrigger>');
  expect(xml).toContain('<Interval>PT5M</Interval>');
  expect(xml).toContain('<StartBoundary>2025-01-01T00:00:00</StartBoundary>');
  expect(xml).not.toContain('<StartCalendarInterval>');
});

test('generates daily CalendarTrigger at specific time', () => {
  const xml = schtasksXmlGenerator.generate({
    id: 'job-daily',
    metadata: {},
    executorScript: 'C:\\executor.ps1',
    storageDir: 'C:\\storage',
    command: { command: 'run', args: [], env: {} },
    outputFile: 'C:\\log.txt',
    cronComponents: { minute: '30', hour: '14', day: '*', month: '*', weekday: '*' },
  });

  expect(xml).toContain('<CalendarTrigger>');
  expect(xml).toContain('<ScheduleByDay>');
  expect(xml).toContain('<DaysInterval>1</DaysInterval>');
  expect(xml).toContain('<StartBoundary>2025-01-01T14:30:00</StartBoundary>');
});

test('generates weekly CalendarTrigger with weekday range 1-5/2 (Mon,Wed,Fri)', () => {
  const xml = schtasksXmlGenerator.generate({
    id: 'job-weekly',
    metadata: {},
    executorScript: 'C:\\executor.ps1',
    storageDir: 'C:\\storage',
    command: { command: 'run', args: [], env: {} },
    outputFile: 'C:\\log.txt',
    cronComponents: { minute: '15', hour: '9', day: '*', month: '*', weekday: '1-5/2' },
  });

  expect(xml).toContain('<ScheduleByWeek>');
  expect(xml).toContain('<StartBoundary>2025-01-01T09:15:00</StartBoundary>');
  expect(xml).toContain('<Monday />');
  expect(xml).toContain('<Wednesday />');
  expect(xml).toContain('<Friday />');
});

test('generates monthly CalendarTrigger for specific day', () => {
  const xml = schtasksXmlGenerator.generate({
    id: 'job-monthly',
    metadata: {},
    executorScript: 'C:\\executor.ps1',
    storageDir: 'C:\\storage',
    command: { command: 'run', args: [], env: {} },
    outputFile: 'C:\\log.txt',
    cronComponents: { minute: '0', hour: '6', day: '1', month: '*', weekday: '*' },
  });

  expect(xml).toContain('<ScheduleByMonth>');
  expect(xml).toContain('<StartBoundary>2025-01-01T06:00:00</StartBoundary>');
  expect(xml).toContain('<DaysOfMonth>');
  expect(xml).toContain('<Day>1</Day>');
  expect(xml).toContain('<January /><February /><March /><April /><May /><June />');
  expect(xml).toContain('<July /><August /><September /><October /><November /><December />');
});

test('generates monthly CalendarTrigger for day range 1-5/2 (1,3,5)', () => {
  const xml = schtasksXmlGenerator.generate({
    id: 'job-monthly-range',
    metadata: {},
    executorScript: 'C:\\executor.ps1',
    storageDir: 'C:\\storage',
    command: { command: 'run', args: [], env: {} },
    outputFile: 'C:\\log.txt',
    cronComponents: { minute: '0', hour: '7', day: '1-5/2', month: '*', weekday: '*' },
  });

  expect(xml).toContain('<StartBoundary>2025-01-01T07:00:00</StartBoundary>');
  expect(xml).toContain('<Day>1</Day>');
  expect(xml).toContain('<Day>3</Day>');
  expect(xml).toContain('<Day>5</Day>');
});

test('converts LF to CRLF line endings', () => {
  const xml = schtasksXmlGenerator.generate({
    id: 'line-endings',
    metadata: {},
    executorScript: 'C:\\executor.ps1',
    storageDir: 'C:\\storage',
    command: { command: 'run', args: [], env: {} },
    outputFile: 'C:\\log.txt',
    cronComponents: { minute: '0', hour: '0', day: '*', month: '*', weekday: '*' },
  });

  expect(xml).toContain('\r\n');
  // After stripping CRLFs, there should be no lone \n left
  expect(xml.replace(/\r\n/g, '')).not.toContain('\n');
});

test('throws error for unsupported cron field in minute', () => {
  const make = (): string =>
    schtasksXmlGenerator.generate({
      id: 'invalid',
      metadata: {},
      executorScript: 'C:\\executor.ps1',
      storageDir: 'C:\\storage',
      command: { command: 'run', args: [], env: {} },
      outputFile: 'C:\\log.txt',
      cronComponents: { minute: 'bad', hour: '*', day: '*', month: '*', weekday: '*' },
    });

  expect(make).toThrow('Unsupported cron field: bad');
});

test('generates multiple daily triggers for time ranges', () => {
  const xml = schtasksXmlGenerator.generate({
    id: 'multi-triggers',
    metadata: {},
    executorScript: 'C:\\executor.ps1',
    storageDir: 'C:\\storage',
    command: { command: 'run', args: [], env: {} },
    outputFile: 'C:\\log.txt',
    cronComponents: { minute: '0-30/30', hour: '9-10/1', day: '*', month: '*', weekday: '*' },
  });

  // Hours: 9,10; Minutes: 0,30 => 4 triggers
  const triggers = xml.match(/<CalendarTrigger>/g) ?? [];
  expect(triggers.length).toBe(4);
  expect(xml).toContain('2025-01-01T09:00:00');
  expect(xml).toContain('2025-01-01T09:30:00');
  expect(xml).toContain('2025-01-01T10:00:00');
  expect(xml).toContain('2025-01-01T10:30:00');
});
