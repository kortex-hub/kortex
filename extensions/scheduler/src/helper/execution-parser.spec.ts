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

import { readdir } from 'node:fs/promises';

import { beforeEach, expect, test, vi } from 'vitest';

import { ExecutionParser } from './execution-parser';

// Mock fs/promises before importing SUT
vi.mock(import('node:fs/promises'));

const readdirMock = vi.mocked(readdir as (path: string, options?: { withFileTypes: false }) => Promise<string[]>);

let executionParser: ExecutionParser;
beforeEach(async () => {
  vi.resetAllMocks();
  executionParser = new ExecutionParser();
});

test('parses valid output and returns execution info', () => {
  const id = 'flow-123';
  const tsSec = 1737062400; // arbitrary timestamp (seconds)
  const output = [
    '<<<KORTEX_SCHEDULE_TASK_BEGIN>>>',
    `{"id":"${id}","timestamp":${tsSec}}`,
    '<<<KORTEX_SCHEDULE_TASK_BEGIN_DATA>>>',
    'line1',
    'line2',
    '<<<KORTEX_SCHEDULE_TASK_END_DATA>>>',
    `{"id":"${id}","timestamp":${tsSec},"duration":123,"exitCode":0}`,
    '<<<KORTEX_SCHEDULE_TASK_END>>>',
  ].join('\n');

  const res = executionParser.parseOutput(id, output);
  expect(res).toBeDefined();
  expect(res?.id).toBe(id);
  expect(res?.output).toBe('line1\nline2');
  expect(res?.lastExecution.getTime()).toBe(tsSec * 1000);
  expect(res?.duration).toBe(123 * 1000);
  expect(res?.exitCode).toBe(0);
});

test('handles Windows CRLF line endings', () => {
  const id = 'flow-win';
  const tsSec = 1737062401;
  const output =
    '<<<KORTEX_SCHEDULE_TASK_BEGIN>>>\r\n' +
    `{"id":"${id}","timestamp":${tsSec}}\r\n` +
    '<<<KORTEX_SCHEDULE_TASK_BEGIN_DATA>>>\r\n' +
    'line1\r\n' +
    'line2\r\n' +
    '<<<KORTEX_SCHEDULE_TASK_END_DATA>>>\r\n' +
    `{"id":"${id}","timestamp":${tsSec},"duration":42,"exitCode":1}\r\n` +
    '<<<KORTEX_SCHEDULE_TASK_END>>>';
  const res = executionParser.parseOutput(id, output);
  expect(res).toBeDefined();
  // Normalize for assertion
  expect(res?.output.replace(/\r\n/g, '\n')).toBe('line1\nline2');
  expect(res?.lastExecution.getTime()).toBe(tsSec * 1000);
  expect(res?.duration).toBe(42 * 1000);
  expect(res?.exitCode).toBe(1);
});

test('returns undefined and logs error when markers are missing', () => {
  const spyConsoleError = vi.spyOn(console, 'error');
  const id = 'bad-markers';
  const output = 'some unrelated content without markers';
  const res = executionParser.parseOutput(id, output);
  expect(res).toBeUndefined();
  expect(spyConsoleError).toHaveBeenCalledOnce();
  spyConsoleError.mockRestore();
});

test('returns undefined and logs error when end JSON is malformed', () => {
  const spyConsoleError = vi.spyOn(console, 'error');
  const id = 'bad-json';
  const output =
    '<<<KORTEX_SCHEDULE_TASK_BEGIN>>>\n' +
    `{"id":"${id}","timestamp":1700000000}\n` +
    '<<<KORTEX_SCHEDULE_TASK_BEGIN_DATA>>>\n' +
    'payload\n' +
    '<<<KORTEX_SCHEDULE_TASK_END_DATA>>>\n' +
    // malformed JSON here
    'not-a-json\n' +
    '<<<KORTEX_SCHEDULE_TASK_END>>>';

  const res = executionParser.parseOutput(id, output);
  expect(res).toBeUndefined();
  expect(spyConsoleError).toHaveBeenCalled(); // error from JSON.parse failure
  spyConsoleError.mockRestore();
});

test('trims output between data markers', () => {
  const id = 'trim-test';
  const tsSec = 1700000100;
  const output =
    '<<<KORTEX_SCHEDULE_TASK_BEGIN>>>\n' +
    `{"id":"${id}","timestamp":${tsSec}}\n` +
    '<<<KORTEX_SCHEDULE_TASK_BEGIN_DATA>>>\n' +
    '\n  line with spaces  \n' +
    '\n' +
    '<<<KORTEX_SCHEDULE_TASK_END_DATA>>>\n' +
    `{"id":"${id}","timestamp":${tsSec},"duration":1,"exitCode":0}\n` +
    '<<<KORTEX_SCHEDULE_TASK_END>>>';

  const res = executionParser.parseOutput(id, output);
  expect(res).toBeDefined();
  expect(res?.output).toBe('line with spaces');
});

test('returns the latest execution log file by lexicographic order', async () => {
  readdirMock.mockResolvedValue([
    'execution-2025-01-01T10-00-00.log',
    'notes.txt',
    'execution-2025-02-15T11-30-00.log',
    'execution-2024-12-31T23-59-59.log',
  ]);

  const res = await executionParser.findLatestExecution('/tmp/logs');
  expect(res).toBe('execution-2025-02-15T11-30-00.log');
  expect(readdirMock).toHaveBeenCalledWith('/tmp/logs');
});

test('returns undefined when no execution log files are present', async () => {
  readdirMock.mockResolvedValue(['readme.md', 'foo.log', 'execution-foo.txt']);
  const res = await executionParser.findLatestExecution('/tmp/empty');
  expect(res).toBeUndefined();
});

test('returns undefined when readdir throws', async () => {
  readdirMock.mockRejectedValue(new Error('boom'));
  const res = await executionParser.findLatestExecution('/tmp/error');
  expect(res).toBeUndefined();
});

test('picks first after reverse to ensure descending order', async () => {
  // Intentionally unsorted input
  readdirMock.mockResolvedValue([
    'execution-2025-03-10T09-00-00.log',
    'execution-2025-03-08T09-00-00.log',
    'execution-2025-03-09T09-00-00.log',
  ]);
  const res = await executionParser.findLatestExecution('/tmp/many');
  expect(res).toBe('execution-2025-03-10T09-00-00.log');
});
