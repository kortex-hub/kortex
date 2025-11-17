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

import { type CronComponents, CronParser } from './cron-parser';

let cronParser: CronParser;
beforeEach(async () => {
  vi.resetAllMocks();
  cronParser = new CronParser();
});

test('parse returns components for a full 5-field cron expression', () => {
  const result = cronParser.parse('0 12 * * 1-5');
  expect(result).toEqual({
    minute: '0',
    hour: '12',
    day: '*',
    month: '*',
    weekday: '1-5',
  });
});

test('parse handles extra whitespace and tabs', () => {
  const result = cronParser.parse('  15\t8   1   1   *  ');
  expect(result).toEqual({
    minute: '15',
    hour: '8',
    day: '1',
    month: '1',
    weekday: '*',
  });
});

test('parse fills missing trailing fields with "*"', () => {
  const result = cronParser.parse('*/10 9 15');
  expect(result).toEqual({
    minute: '*/10',
    hour: '9',
    day: '15',
    month: '*',
    weekday: '*',
  });
});

test('parse returns empty string for minute when input is empty, others default to "*"', () => {
  const result = cronParser.parse('');
  expect(result).toEqual({
    minute: '',
    hour: '*',
    day: '*',
    month: '*',
    weekday: '*',
  });
});

test('parse ignores extra fields beyond the 5 standard ones', () => {
  const result = cronParser.parse('0 0 1 1 * EXTRA FIELDS IGNORED');
  expect(result).toEqual({
    minute: '0',
    hour: '0',
    day: '1',
    month: '1',
    weekday: '*',
  });
});

test('toCronExpression joins components in correct order', () => {
  const components: CronComponents = {
    minute: '5',
    hour: '6',
    day: '7',
    month: '8',
    weekday: '9',
  };
  expect(cronParser.toCronExpression(components)).toBe('5 6 7 8 9');
});

test('round-trip: parse -> toCronExpression with full expression preserves value', () => {
  const expr = '0 0 * * 0';
  const parsed = cronParser.parse(expr);
  expect(cronParser.toCronExpression(parsed)).toBe(expr);
});

test('round-trip: parse -> toCronExpression expands missing fields to "*"', () => {
  const expr = '*/5 0 *';
  const parsed = cronParser.parse(expr);
  // Expanded expression should include default "*" for month and weekday
  expect(cronParser.toCronExpression(parsed)).toBe('*/5 0 * * *');
});
