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

import type { ProviderSchedulerCommand } from '@kortex-app/api';
import { injectable } from 'inversify';
import mustache from 'mustache';

import type { CronComponents } from '/@/helper/cron-parser';
import taskTemplate from '/@/helper/windows/templates/task.mustache?raw';

export interface SchtasksXmlOptions {
  id: string;
  metadata: Record<string, string>;
  executorScript: string;
  storageDir: string;
  command: ProviderSchedulerCommand;
  outputFile: string;
  cronComponents: CronComponents;
}

interface TimeTrigger {
  intervalMinutes: number;
}

interface CalendarTrigger {
  startBoundary: string;
  daysOfWeek?: string;
  daysOfMonth?: string;
  everyDay?: boolean;
}

interface TaskTemplateData {
  id: string;
  escapedId: string;
  metadataXml: string;
  timeTriggers: TimeTrigger[];
  calendarTriggers: CalendarTrigger[];
  executorScript: string;
  args: string;
  envArgs: string;
}

@injectable()
export class SchtasksXmlGenerator {
  generate(options: SchtasksXmlOptions): string {
    const { id, executorScript, storageDir, command, cronComponents, metadata } = options;

    // Build metadata as JSON string
    const metadataJson = JSON.stringify(metadata);
    const escapedMetadataJson = this.escapePowerShellArg(metadataJson);

    // Build command arguments - using plain quotes
    const commandArgs = [command.command, ...command.args].map(arg => `"${arg}"`).join(' ');

    // Complete arguments string for the executor
    const allArgs = `"${this.escapePowerShellArg(storageDir)}" "${this.escapePowerShellArg(id)}" -Metadata ${escapedMetadataJson} ${commandArgs}`;

    // Build triggers
    const { timeTriggers, calendarTriggers } = this.buildTriggers(cronComponents);

    // Build env args
    const envArgs = this.buildEnvArgs(command.env);

    // Build metadata XML
    const metadataXml = Object.entries(metadata)
      .map(([key, value]) => `      <${this.escapeXml(key)}>${this.escapeXml(value)}</${this.escapeXml(key)}>`)
      .join('\n');

    const templateData: TaskTemplateData = {
      id,
      escapedId: this.escapeXml(id),
      metadataXml,
      timeTriggers,
      calendarTriggers,
      executorScript,
      args: allArgs,
      envArgs,
    };

    const xml = mustache.render(taskTemplate, templateData);
    // Convert LF to CRLF for Windows compatibility
    return xml.replace(/\n/g, '\r\n');
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private buildTriggers(components: CronComponents): {
    timeTriggers: TimeTrigger[];
    calendarTriggers: CalendarTrigger[];
  } {
    // Helper: expand cron expressions into numbers
    const expandField = (field: string, max: number): number[] => {
      if (field === '*') return [];

      if (field.startsWith('*/')) {
        const step = Number.parseInt(field.slice(2), 10);
        const result: number[] = [];
        for (let i = 0; i <= max; i += step) result.push(i);
        return result;
      }

      const rangeMatch = RegExp(/^(\d+)-(\d+)\/(\d+)$/).exec(field);
      if (rangeMatch) {
        const start = Number.parseInt(rangeMatch[1], 10);
        const end = Number.parseInt(rangeMatch[2], 10);
        const step = Number.parseInt(rangeMatch[3], 10);
        const result: number[] = [];
        for (let i = start; i <= end; i += step) result.push(i);
        return result;
      }

      if (/^\d+$/.test(field)) return [Number.parseInt(field, 10)];

      throw new Error(`Unsupported cron field: ${field}`);
    };

    // Check for simple interval pattern (*/N minutes with all else wildcards)
    if (
      components.minute.startsWith('*/') &&
      components.hour === '*' &&
      components.day === '*' &&
      components.month === '*' &&
      components.weekday === '*'
    ) {
      const intervalMinutes = Number.parseInt(components.minute.slice(2), 10);
      return {
        timeTriggers: [{ intervalMinutes }],
        calendarTriggers: [],
      };
    }

    // For complex schedules, create CalendarTrigger with ScheduleByDay/Week/Month
    const minutes = expandField(components.minute, 59);
    const hours = expandField(components.hour, 23);
    const days = expandField(components.day, 31);
    const weekdays = expandField(components.weekday, 7);

    // Generate triggers for each time combination
    const calendarTriggers: CalendarTrigger[] = [];

    const hoursList = hours.length ? hours : [0];
    const minutesList = minutes.length ? minutes : [0];

    for (const h of hoursList) {
      for (const m of minutesList) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
        const startBoundary = `2025-01-01T${time}`;

        if (weekdays.length > 0) {
          // Weekly trigger
          const daysOfWeek = weekdays.map(w => this.getDayOfWeekName(w)).join('');
          calendarTriggers.push({ startBoundary, daysOfWeek });
        } else if (days.length > 0) {
          // Monthly trigger with specific days
          const daysOfMonth = days.map(d => `<Day>${d}</Day>`).join('\n          ');
          calendarTriggers.push({ startBoundary, daysOfMonth });
        } else {
          // Daily trigger
          calendarTriggers.push({ startBoundary, everyDay: true });
        }
      }
    }

    return {
      timeTriggers: [],
      calendarTriggers,
    };
  }

  private getDayOfWeekName(day: number): string {
    const days = [
      '<Sunday />',
      '<Monday />',
      '<Tuesday />',
      '<Wednesday />',
      '<Thursday />',
      '<Friday />',
      '<Saturday />',
    ];
    return days[day % 7];
  }

  private buildEnvArgs(env?: Record<string, string>): string {
    if (!env || Object.keys(env).length === 0) {
      return '';
    }
    // Escape quotes for command line
    const envJson = JSON.stringify(env).replace(/"/g, '\\"');
    return ` -envJson "${envJson}"`;
  }

  private escapePowerShellArg(text: string): string {
    // Escape special characters for PowerShell arguments
    // Replace backticks, quotes, and dollar signs
    return text
      .replace(/`/g, '``') // Escape backticks
      .replace(/"/g, '`"') // Escape double quotes
      .replace(/\$/g, '`$'); // Escape dollar signs
  }
}
