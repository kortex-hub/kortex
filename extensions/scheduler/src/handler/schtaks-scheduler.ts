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

import * as fs from 'node:fs/promises';
import { homedir } from 'node:os';
import * as path from 'node:path';

import type {
  ProviderScheduleExecution,
  ProviderScheduleItem,
  ProviderScheduleResult,
  ProviderSchedulerOptions,
  RunError,
} from '@kortex-app/api';
import { process } from '@kortex-app/api';
import { inject, injectable } from 'inversify';

import type { NativeScheduler } from '/@/api/native-scheduler-api.js';
import { CronParser } from '/@/helper/cron-parser.js';
import { ExecutionParser } from '/@/helper/execution-parser.js';
import { CronXmlParser } from '/@/helper/windows/cron-xml-parser.js';
import schedulerExecutorScript from '/@/resources/kortex-scheduler-executor.ps1?raw';

import { SchtasksXmlGenerator } from '../helper/windows/schtasks-xml-generator.js';

@injectable()
export class SchtasksScheduler implements NativeScheduler {
  public static readonly NAME = 'schtasks';
  private readonly tasksDir: string;
  private readonly schedulerBaseDir: string;
  private readonly scriptsDir: string;

  @inject(CronParser)
  private readonly cronParser: CronParser;

  @inject(CronXmlParser)
  private readonly cronXmlParser: CronXmlParser;

  @inject(SchtasksXmlGenerator)
  private readonly xmlGenerator: SchtasksXmlGenerator;

  @inject(ExecutionParser)
  private readonly executionParser: ExecutionParser;

  constructor() {
    this.schedulerBaseDir = path.join(homedir(), '.local', 'share', 'kortex', 'scheduler');
    this.tasksDir = path.join(this.schedulerBaseDir, 'tasks');
    this.scriptsDir = path.join(this.schedulerBaseDir, 'scripts');
  }

  async init(): Promise<void> {
    // Create necessary directories
    await fs.mkdir(this.scriptsDir, { recursive: true });
    await fs.mkdir(this.tasksDir, { recursive: true });

    // Write kortex-scheduler-executor.ps1 all the time to ensure it's up to date
    const targetScript = path.join(this.scriptsDir, 'kortex-scheduler-executor.ps1');
    await fs.writeFile(targetScript, schedulerExecutorScript, 'utf-8');
  }

  async schedule(options: ProviderSchedulerOptions): Promise<ProviderScheduleResult> {
    // generate uuid for the schedule
    const id = crypto.randomUUID();

    const flowLogDir = path.join(this.schedulerBaseDir, id);

    const executorScript = path.join(this.scriptsDir, 'kortex-scheduler-executor.ps1');
    const outputFile = path.join(flowLogDir, 'latest.log');

    const cronComponents = this.cronParser.parse(options.cronExpression);
    const xmlContent = this.xmlGenerator.generate({
      id,
      metadata: options.metadata,
      executorScript,
      storageDir: this.schedulerBaseDir,
      command: options.command,
      outputFile,
      cronComponents,
    });

    const xmlPath = this.getTaskXmlPath(id);
    await fs.writeFile(xmlPath, xmlContent, 'utf-8');

    // Create the scheduled task
    const taskName = `Kortex\\${id}`;
    try {
      const args = ['/Create', '/TN', taskName, '/XML', xmlPath, '/F'];
      await process.exec('schtasks', args);
    } catch (error: unknown) {
      const runError = error as RunError;
      console.error(`Failed to create scheduled task: ${runError.stderr || runError.message}`);
      throw new Error(`Failed to create scheduled task: ${error}`);
    }

    return {
      id,
    };
  }

  async cancel(id: string): Promise<void> {
    const taskName = `Kortex\\${id}`;

    // Delete the scheduled task
    try {
      await process.exec('schtasks', ['/Delete', '/TN', taskName, '/F']);
    } catch {
      // Ignore if task doesn't exist
    }

    // Delete XML file
    const xmlPath = this.getTaskXmlPath(id);
    try {
      await fs.unlink(xmlPath);
    } catch {
      // Ignore if doesn't exist
    }

    // Delete log directory
    const logDir = path.join(this.schedulerBaseDir, id);
    try {
      await fs.rm(logDir, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  }

  async list(): Promise<ProviderScheduleItem[]> {
    const flows: ProviderScheduleItem[] = [];

    try {
      // Query all tasks in Kortex folder
      const { stdout } = await process.exec('powershell', [
        '-Command',
        'Get-ScheduledTask -TaskPath "\\Kortex\\*" | Select-Object -ExpandProperty TaskName',
      ]);
      // Parse output - each line is a task name
      const taskNames = stdout
        .trim()
        .split('\n')
        .map(name => name.trim())
        .filter(name => name.length > 0);

      for (const id of taskNames) {
        const xmlPath = this.getTaskXmlPath(id);

        try {
          const content = await fs.readFile(xmlPath, 'utf-8');

          const cronExpression = this.cronXmlParser.extractFromXml(content);

          // Extract metadata from RegistrationInfo/Metadata section
          // Extract metadata from CDATA section inside Description
          const metadata: Record<string, string> = {};
          const descriptionMatch = RegExp(/<Description><!\[CDATA\[(.*?)\]\]><\/Description>/s).exec(content);
          if (descriptionMatch) {
            const cdataContent = descriptionMatch[1];

            // Extract metadata section from CDATA content
            const metadataMatch = RegExp(/<Metadata>(.*?)<\/Metadata>/s).exec(cdataContent);
            if (metadataMatch) {
              const metadataContent = metadataMatch[1];

              // Match all key-value pairs like <key>value</key>
              const entryMatches = metadataContent.matchAll(/<([a-zA-Z0-9_-]+)>([^<]*?)<\/\1>/g);
              for (const match of entryMatches) {
                const key = match[1].trim();
                const value = match[2].trim();
                if (key && value && key !== 'Name') {
                  metadata[key] = value;
                }
              }
            }
          }

          flows.push({
            id,
            cronExpression,
            metadata,
          });
        } catch (error: unknown) {
          console.error(`Failed to read or parse XML for task ${id}: ${error}`);
        }
      }
    } catch (error: unknown) {
      console.error(`Failed to list scheduled tasks: ${error}`);
    }
    return flows;
  }

  async getExecution(id: string): Promise<ProviderScheduleExecution | undefined> {
    const logDir = path.join(this.schedulerBaseDir, id);

    // Find the latest execution file
    const latestFile = await this.executionParser.findLatestExecution(logDir);
    if (!latestFile) {
      return undefined;
    }

    const logFilePath = path.join(logDir, latestFile);

    try {
      const content = await fs.readFile(logFilePath, 'utf-8');
      const result = this.executionParser.parseOutput(id, content);
      return result;
    } catch (error: unknown) {
      console.error(`Failed to read or parse log file for task ${id}: ${error}`);
      return undefined;
    }
  }

  private getTaskXmlPath(schedulerId: string): string {
    return path.join(this.tasksDir, `${schedulerId}.xml`);
  }

  public readonly name: string = SchtasksScheduler.NAME;
}
