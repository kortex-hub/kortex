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

import { Container } from 'inversify';
import { beforeEach, expect, test, vi } from 'vitest';

import { CronParser } from '/@/helper/cron-parser';

import { CronPListParser } from './cron-plist-parser';

const cronParserMock = {
  toCronExpression: vi.fn(),
  parse: vi.fn(),
} as unknown as CronParser;

let cronPListParser: CronPListParser;

beforeEach(async () => {
  vi.resetAllMocks();
  const container = new Container();
  container.bind<CronParser>(CronParser).toConstantValue(cronParserMock);
  container.bind<CronPListParser>(CronPListParser).toSelf().inSingletonScope();
  cronPListParser = container.get(CronPListParser);
});

test('parses all fields and forwards to CronParser', () => {
  const plist = `
    <plist version="1.0">
      <dict>
        <key>Minute</key><integer>5</integer>
        <key>Hour</key><integer>12</integer>
        <key>Day</key><integer>31</integer>
        <key>Month</key><integer>7</integer>
        <key>Weekday</key><integer>1</integer>
      </dict>
    </plist>
  `;
  vi.mocked(cronParserMock.toCronExpression).mockReturnValue('CRON_ALL_FIELDS');

  const result = cronPListParser.extractFromPlist(plist);

  expect(cronParserMock.toCronExpression).toHaveBeenCalledTimes(1);
  expect(cronParserMock.toCronExpression).toHaveBeenCalledWith({
    minute: '5',
    hour: '12',
    day: '31',
    month: '7',
    weekday: '1',
  });
  expect(result).toBe('CRON_ALL_FIELDS');
});

test('defaults to * when fields are missing', () => {
  const plist = `
    <plist version="1.0">
      <dict>
        <key>Hour</key><integer>8</integer>
      </dict>
    </plist>
  `;
  vi.mocked(cronParserMock.toCronExpression).mockReturnValue('CRON_DEFAULTS');

  const result = cronPListParser.extractFromPlist(plist);

  expect(cronParserMock.toCronExpression).toHaveBeenCalledWith({
    minute: '*',
    hour: '8',
    day: '*',
    month: '*',
    weekday: '*',
  });
  expect(result).toBe('CRON_DEFAULTS');
});

test('uses the first occurrence when multiple keys exist', () => {
  const plist = `
    <plist version="1.0">
      <dict>
        <key>Minute</key><integer>5</integer>
        <key>Minute</key><integer>10</integer>
        <key>Hour</key><integer>6</integer>
      </dict>
    </plist>
  `;
  vi.mocked(cronParserMock.toCronExpression).mockReturnValue('CRON_FIRST_MATCH');

  const result = cronPListParser.extractFromPlist(plist);

  expect(cronParserMock.toCronExpression).toHaveBeenCalledWith({
    minute: '5', // first occurrence only
    hour: '6',
    day: '*',
    month: '*',
    weekday: '*',
  });
  expect(result).toBe('CRON_FIRST_MATCH');
});

test('returns defaults when no schedule keys are present', () => {
  const plist = `
    <plist version="1.0">
      <dict>
        <key>Label</key><string>com.example.job</string>
      </dict>
    </plist>
  `;
  vi.mocked(cronParserMock.toCronExpression).mockReturnValue('CRON_ALL_DEFAULTS');

  const result = cronPListParser.extractFromPlist(plist);

  expect(cronParserMock.toCronExpression).toHaveBeenCalledWith({
    minute: '*',
    hour: '*',
    day: '*',
    month: '*',
    weekday: '*',
  });
  expect(result).toBe('CRON_ALL_DEFAULTS');
});
