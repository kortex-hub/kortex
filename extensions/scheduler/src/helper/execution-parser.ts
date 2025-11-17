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

import type { ProviderScheduleExecution } from '@kortex-app/api';
import { injectable } from 'inversify';

@injectable()
export class ExecutionParser {
  parseOutput(id: string, output: string): ProviderScheduleExecution | undefined {
    // Expected format in output file:
    // <<<KORTEX_SCHEDULE_TASK_BEGIN>>>
    // {"id":"flow-id","timestamp":1234567890}
    // <<<KORTEX_SCHEDULE_TASK_BEGIN_DATA>>>
    // ...execution output...
    // <<<KORTEX_SCHEDULE_TASK_END_DATA>>>
    // {"id":"flow-id","timestamp":1234567890,"duration":123,"exitCode":0}
    // <<<KORTEX_SCHEDULE_TASK_END>>>

    const beginMatch = /<<<KORTEX_SCHEDULE_TASK_BEGIN_DATA>>>\r?\n/.exec(output);

    const endMatch = /<<<KORTEX_SCHEDULE_TASK_END_DATA>>>\r?\n([\s\S]*?)\r?\n<<<KORTEX_SCHEDULE_TASK_END>>>/.exec(
      output,
    );

    if (!beginMatch || !endMatch?.[1]) {
      console.error('ExecutionParser, data cannot be parsed from content', output);
      return undefined;
    }

    try {
      const endData = JSON.parse(endMatch[1]);

      // output is between KORTEX_SCHEDULE_TASK_BEGIN_DATA and KORTEX_SCHEDULE_TASK_END_DATA
      const content = output.slice(beginMatch.index + beginMatch[0].length, endMatch.index).trim();
      return {
        id,
        output: content,
        lastExecution: new Date(endData.timestamp * 1000),
        duration: endData.duration * 1000, // Convert to milliseconds
        exitCode: endData.exitCode,
      };
    } catch (error: unknown) {
      console.error(`Failed to parse execution log for task ${id}`, error);
      return undefined;
    }
  }

  async findLatestExecution(logDir: string): Promise<string | undefined> {
    try {
      const files = await readdir(logDir);
      const executionFiles = files
        .filter(f => f.startsWith('execution-') && f.endsWith('.log'))
        .sort((a, b) => a.localeCompare(b))
        .reverse();

      return executionFiles.length > 0 ? executionFiles[0] : undefined;
    } catch {
      return undefined;
    }
  }
}
