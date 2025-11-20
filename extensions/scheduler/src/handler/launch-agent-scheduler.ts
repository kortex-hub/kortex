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
} from '@kortex-app/api';
import { process } from '@kortex-app/api';
import { inject, injectable } from 'inversify';

import type { NativeScheduler } from '/@/api/native-scheduler-api';
import { CronParser } from '/@/helper/cron-parser.js';
import { ExecutionParser } from '/@/helper/execution-parser.js';
import { CronPListParser } from '/@/helper/macos/cron-plist-parser.js';
import { PlistGenerator } from '/@/helper/macos/plist-generator';
import schedulerExecutorScript from '/@/resources/kortex-scheduler-executor.sh?raw';

@injectable()
export class LaunchAgentScheduler implements NativeScheduler {
  public static readonly NAME = 'launch-agents';
  private readonly launchAgentsDir: string;
  private readonly schedulerBaseDir: string;
  private readonly scriptsDir: string;

  @inject(CronParser)
  private readonly cronParser: CronParser;

  @inject(CronPListParser)
  private readonly cronPListParser: CronPListParser;

  @inject(PlistGenerator)
  private readonly plistGenerator: PlistGenerator;

  @inject(ExecutionParser)
  private readonly executionParser: ExecutionParser;

  constructor() {
    this.launchAgentsDir = path.join(homedir(), 'Library', 'LaunchAgents');
    this.schedulerBaseDir = path.join(homedir(), '.local', 'share', 'kortex', 'scheduler');
    this.scriptsDir = path.join(this.schedulerBaseDir, 'scripts');
  }

  async init(): Promise<void> {
    // Create necessary directories
    await fs.mkdir(this.scriptsDir, { recursive: true });
    await fs.mkdir(this.launchAgentsDir, { recursive: true });

    // Write kortex-scheduler-executor.sh all the time to ensure it's up to date
    const targetScript = path.join(this.scriptsDir, 'kortex-scheduler-executor.sh');
    await fs.writeFile(targetScript, schedulerExecutorScript, 'utf-8');
    await fs.chmod(targetScript, 0o700);
  }

  async schedule(options: ProviderSchedulerOptions): Promise<ProviderScheduleResult> {
    // generate uuid for the schedule
    const id = crypto.randomUUID();

    const flowLogDir = path.join(this.schedulerBaseDir, id);

    const executorScript = path.join(this.scriptsDir, 'kortex-scheduler-executor.sh');
    const outputFile = path.join(flowLogDir, 'latest.log');

    const cronComponents = this.cronParser.parse(options.cronExpression);
    const plistContent = this.plistGenerator.generate({
      id,
      metadata: options.metadata,
      executorScript,
      storageDir: this.schedulerBaseDir,
      command: options.command,
      outputFile,
      cronComponents,
    });

    const plistPath = this.getPlistPath(id);
    await fs.writeFile(plistPath, plistContent, 'utf-8');

    // Load the launch agent
    try {
      await process.exec('launchctl', ['load', plistPath]);
    } catch (error) {
      // Try to unload first if already loaded, then load again
      try {
        await process.exec('launchctl', ['unload', plistPath]);
        await process.exec('launchctl', ['load', plistPath]);
      } catch {
        throw error;
      }
    }

    return {
      id,
    };
  }

  async cancel(id: string): Promise<void> {
    const plistPath = this.getPlistPath(id);

    // Unload the launch agent
    try {
      await process.exec('launchctl', ['unload', plistPath]);
    } catch {
      // Ignore if not loaded
    }

    // Delete plist file
    try {
      await fs.unlink(plistPath);
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
      const files = await fs.readdir(this.launchAgentsDir);
      const kortexPlists = files.filter(f => f.startsWith('io.github.kortex-hub.kortex.') && f.endsWith('.plist'));

      for (const plistFile of kortexPlists) {
        const id = plistFile.replace('io.github.kortex-hub.kortex.', '').replace('.plist', '');
        const plistPath = this.getPlistPath(id);
        const content = await fs.readFile(plistPath, 'utf-8');

        const cronExpression = this.cronPListParser.extractFromPlist(content);

        const metadata = Object.fromEntries(
          [
            ...(RegExp(/<key>metadata<\/key>\s*<dict>([\s\S]*?)<\/dict>/)
              .exec(content)?.[1]
              .matchAll(/<key>(.*?)<\/key>\s*<string>(.*?)<\/string>/g) ?? []),
          ].map(([, k, v]) => [k, v]),
        );

        flows.push({
          id,
          cronExpression,
          metadata,
        });
      }
    } catch {
      // Return empty array if directory doesn't exist
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
      return this.executionParser.parseOutput(id, content);
    } catch {
      return undefined;
    }
  }

  private getPlistPath(schedulerId: string): string {
    return path.join(this.launchAgentsDir, `io.github.kortex-hub.kortex.${schedulerId}.plist`);
  }

  public readonly name: string = LaunchAgentScheduler.NAME;
}
