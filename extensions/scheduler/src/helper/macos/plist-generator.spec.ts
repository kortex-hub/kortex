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

import type { PlistOptions } from './plist-generator';
import { PlistGenerator } from './plist-generator';

let plistGenerator: PlistGenerator;

beforeEach(async () => {
  vi.resetAllMocks();
  plistGenerator = new PlistGenerator();
});

test('generates valid plist with required fields', () => {
  const options: PlistOptions = {
    id: 'test-job-123',
    metadata: {},
    executorScript: '/usr/local/bin/executor.sh',
    storageDir: '/var/lib/kortex/storage',
    command: {
      command: 'docker',
      args: ['ps', '-a'],
      env: {},
    },
    outputFile: '/var/log/test-job.log',
    cronComponents: {
      minute: '0',
      hour: '12',
      day: '*',
      month: '*',
      weekday: '*',
    },
  };

  const result = plistGenerator.generate(options);

  expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  expect(result).toContain('<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"');
  expect(result).toContain('<plist version="1.0">');
  expect(result).toContain('<key>Label</key>');
  expect(result).toContain('<string>io.github.kortex-hub.kortex.schedule.test-job-123</string>');
  expect(result).toContain('<key>ProgramArguments</key>');
  expect(result).toContain('<string>/usr/local/bin/executor.sh</string>');
  expect(result).toContain('<string>/var/lib/kortex/storage</string>');
  expect(result).toContain('<string>test-job-123</string>');
  expect(result).toContain('<string>docker</string>');
  expect(result).toContain('<string>ps</string>');
  expect(result).toContain('<string>-a</string>');
  expect(result).toContain('<key>StandardOutPath</key>');
  expect(result).toContain('<string>/var/log/test-job.log</string>');
  expect(result).toContain('<key>StandardErrorPath</key>');
  expect(result).toContain('<string>/var/log/test-job.log.err</string>');
});

test('includes metadata in ProgramArguments', () => {
  const options: PlistOptions = {
    id: 'job-with-metadata',
    metadata: {
      type: 'foo',
      hello: 'bar',
    },
    executorScript: '/usr/local/bin/executor.sh',
    storageDir: '/var/lib/kortex',
    command: { command: 'echo', args: ['hello'], env: {} },
    outputFile: '/var/log/job.log',
    cronComponents: { minute: '*', hour: '*', day: '*', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  expect(result).toContain('<string>--metadata</string>');
  expect(result).toContain('<string>type=foo</string>');
  expect(result).toContain('<string>--metadata</string>');
  expect(result).toContain('<string>hello=bar</string>');
});

test('includes metadata dictionary in plist', () => {
  const options: PlistOptions = {
    id: 'job-with-metadata-dict',
    metadata: {
      jobType: 'backup',
      version: '1.0',
    },
    executorScript: '/usr/local/bin/executor.sh',
    storageDir: '/var/lib/kortex',
    command: { command: 'backup', args: [], env: {} },
    outputFile: '/var/log/backup.log',
    cronComponents: { minute: '0', hour: '2', day: '*', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  expect(result).toContain('<key>metadata</key>');
  expect(result).toContain('<dict>');
  expect(result).toContain('<key>jobType</key>');
  expect(result).toContain('<string>backup</string>');
  expect(result).toContain('<key>version</key>');
  expect(result).toContain('<string>1.0</string>');
});

test('escapes special XML characters in command arguments', () => {
  const options: PlistOptions = {
    id: 'escape-test',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: {
      command: 'echo',
      args: ['<tag>', 'a&b', '"quoted"', `'single'`],
      env: {},
    },
    outputFile: '/dev/null',
    cronComponents: { minute: '*', hour: '*', day: '*', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  expect(result).toContain('&lt;tag&gt;');
  expect(result).toContain('a&amp;b');
  expect(result).toContain('&quot;quoted&quot;');
  expect(result).toContain('&apos;single&apos;');
});

test('escapes special characters in metadata values', () => {
  const options: PlistOptions = {
    id: 'metadata-escape',
    metadata: {
      description: 'Job with <special> & "chars"',
    },
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: { command: 'test', args: [], env: {} },
    outputFile: '/dev/null',
    cronComponents: { minute: '*', hour: '*', day: '*', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  expect(result).toContain('description=Job with &lt;special&gt; &amp; &quot;chars&quot;');
  expect(result).toContain('<key>description</key>');
  expect(result).toContain('<string>Job with &lt;special&gt; &amp; &quot;chars&quot;</string>');
});

test('includes environment variables when provided', () => {
  const options: PlistOptions = {
    id: 'env-test',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: {
      command: 'node',
      args: ['script.js'],
      env: {
        NODE_ENV: 'production',
        API_KEY: 'secret123',
      },
    },
    outputFile: '/var/log/node.log',
    cronComponents: { minute: '*/5', hour: '*', day: '*', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  expect(result).toContain('<key>EnvironmentVariables</key>');
  expect(result).toContain('<key>NODE_ENV</key>');
  expect(result).toContain('<string>production</string>');
  expect(result).toContain('<key>API_KEY</key>');
  expect(result).toContain('<string>secret123</string>');
});

test('omits EnvironmentVariables section when env is empty', () => {
  const options: PlistOptions = {
    id: 'no-env',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: { command: 'test', args: [], env: {} },
    outputFile: '/dev/null',
    cronComponents: { minute: '*', hour: '*', day: '*', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  expect(result).not.toContain('<key>EnvironmentVariables</key>');
});

test('escapes special characters in environment variable values', () => {
  const options: PlistOptions = {
    id: 'env-escape',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: {
      command: 'test',
      args: [],
      env: {
        PATH: '/usr/bin:/bin',
        MESSAGE: 'Hello & <world>',
      },
    },
    outputFile: '/dev/null',
    cronComponents: { minute: '*', hour: '*', day: '*', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  expect(result).toContain('<string>Hello &amp; &lt;world&gt;</string>');
});

test('generates StartInterval for minute-only wildcard expressions', () => {
  const options: PlistOptions = {
    id: 'interval-test',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: { command: 'test', args: [], env: {} },
    outputFile: '/dev/null',
    cronComponents: { minute: '*/5', hour: '*', day: '*', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  expect(result).toContain('<key>StartInterval</key>');
  expect(result).toContain('<integer>300</integer>'); // 5 minutes = 300 seconds
  expect(result).not.toContain('<key>StartCalendarInterval</key>');
});

test('generates StartCalendarInterval for specific time', () => {
  const options: PlistOptions = {
    id: 'calendar-test',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: { command: 'test', args: [], env: {} },
    outputFile: '/dev/null',
    cronComponents: { minute: '30', hour: '14', day: '*', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  expect(result).toContain('<key>StartCalendarInterval</key>');
  expect(result).toContain('<key>Hour</key>');
  expect(result).toContain('<integer>14</integer>');
  expect(result).toContain('<key>Minute</key>');
  expect(result).toContain('<integer>30</integer>');
});

test('generates multiple calendar intervals for range expressions', () => {
  const options: PlistOptions = {
    id: 'range-test',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: { command: 'test', args: [], env: {} },
    outputFile: '/dev/null',
    cronComponents: { minute: '0', hour: '9-17/2', day: '*', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  expect(result).toContain('<key>StartCalendarInterval</key>');
  expect(result).toContain('<array>');
  // Should generate intervals for hours: 9, 11, 13, 15, 17
  const hourMatches = result.match(/<key>Hour<\/key>/g);
  expect(hourMatches).toHaveLength(5);
});

test('includes day in calendar interval', () => {
  const options: PlistOptions = {
    id: 'day-test',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: { command: 'test', args: [], env: {} },
    outputFile: '/dev/null',
    cronComponents: { minute: '0', hour: '0', day: '1', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  expect(result).toContain('<key>Day</key>');
  expect(result).toContain('<integer>1</integer>');
});

test('includes month in calendar interval', () => {
  const options: PlistOptions = {
    id: 'month-test',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: { command: 'test', args: [], env: {} },
    outputFile: '/dev/null',
    cronComponents: { minute: '0', hour: '0', day: '1', month: '6', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  expect(result).toContain('<key>Month</key>');
  expect(result).toContain('<integer>6</integer>');
});

test('includes weekday in calendar interval', () => {
  const options: PlistOptions = {
    id: 'weekday-test',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: { command: 'test', args: [], env: {} },
    outputFile: '/dev/null',
    cronComponents: { minute: '0', hour: '9', day: '*', month: '*', weekday: '1' },
  };

  const result = plistGenerator.generate(options);

  expect(result).toContain('<key>Weekday</key>');
  expect(result).toContain('<integer>1</integer>');
});

test('handles all wildcards', () => {
  const options: PlistOptions = {
    id: 'wildcard-test',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: { command: 'test', args: [], env: {} },
    outputFile: '/dev/null',
    cronComponents: { minute: '*', hour: '*', day: '*', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  // All wildcards should produce a single empty interval
  expect(result).toContain('<key>StartCalendarInterval</key>');
  expect(result).toContain('<array>');
  expect(result).toContain('<dict>');
});

test('handles empty command args', () => {
  const options: PlistOptions = {
    id: 'no-args',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: { command: 'uptime', args: [], env: {} },
    outputFile: '/dev/null',
    cronComponents: { minute: '0', hour: '*', day: '*', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  expect(result).toContain('<string>uptime</string>');
  expect(result).toContain('<key>ProgramArguments</key>');
});

test('handles no metadata', () => {
  const options: PlistOptions = {
    id: 'no-metadata',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: { command: 'test', args: [], env: {} },
    outputFile: '/dev/null',
    cronComponents: { minute: '*', hour: '*', day: '*', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  expect(result).not.toContain('<key>metadata</key>');
  expect(result).toContain('<key>Label</key>');
});

test('generates valid plist structure', () => {
  const options: PlistOptions = {
    id: 'structure-test',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: { command: 'test', args: [], env: {} },
    outputFile: '/dev/null',
    cronComponents: { minute: '0', hour: '12', day: '*', month: '*', weekday: '*' },
  };

  const result = plistGenerator.generate(options);

  // Check proper XML structure
  const openDicts = (result.match(/<dict>/g) ?? []).length;
  const closeDicts = (result.match(/<\/dict>/g) ?? []).length;
  expect(openDicts).toBe(closeDicts);

  const openArrays = (result.match(/<array>/g) ?? []).length;
  const closeArrays = (result.match(/<\/array>/g) ?? []).length;
  expect(openArrays).toBe(closeArrays);

  expect(result).toContain('</plist>');
});

test('throws error for unsupported cron field format', () => {
  const options: PlistOptions = {
    id: 'invalid-cron',
    metadata: {},
    executorScript: '/bin/sh',
    storageDir: '/storage',
    command: { command: 'test', args: [], env: {} },
    outputFile: '/dev/null',
    cronComponents: { minute: 'invalid-format', hour: '*', day: '*', month: '*', weekday: '*' },
  };

  expect(() => plistGenerator.generate(options)).toThrow('Unsupported cron field: invalid-format');
});
