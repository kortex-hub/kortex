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

import type { CronComponents } from '/@/helper/cron-parser';

export interface PlistOptions {
  id: string;
  metadata: Record<string, string>;
  executorScript: string;
  storageDir: string;
  command: ProviderSchedulerCommand;
  outputFile: string;
  cronComponents: CronComponents;
}

@injectable()
export class PlistGenerator {
  generate(options: PlistOptions): string {
    const { id, executorScript, storageDir, command, outputFile, cronComponents } = options;

    // create --metadata key=value arguments for each metadata entry
    const metadataEntries = Object.entries(options.metadata)
      .map(
        ([key, value]) =>
          `        <string>--metadata</string>\n        <string>${this.escapeXml(key)}=${this.escapeXml(value)}</string>`,
      )
      .join('\n');

    const calendarInterval = this.buildCalendarInterval(cronComponents);
    const environmentVariables = this.buildEnvironmentVariables(command.env);

    // create metadata dictionary for plist
    const metadataDict = this.buildMetadataDict(options.metadata);

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>io.github.kortex-hub.kortex.schedule.${id}</string>
${metadataDict}
    <key>ProgramArguments</key>
    <array>
        <string>${executorScript}</string>
        <string>${storageDir}</string>
        <string>${id}</string>
${metadataEntries}
        <string>${command.command}</string>
${command.args.map(arg => `        <string>${this.escapeXml(arg)}</string>`).join('\n')}
    </array>
${environmentVariables}
${calendarInterval}
    <key>StandardOutPath</key>
    <string>${outputFile}</string>
    <key>StandardErrorPath</key>
    <string>${outputFile}.err</string>
</dict>
</plist>`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private buildCalendarInterval(components: CronComponents): string {
    // Helper: expand expressions like "2-22/4" or "*/5" into numbers
    const expandField = (field: string, max: number): number[] => {
      if (field === '*') return []; // empty means "wildcard, ignore in calendar interval"

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

      // single integer
      if (/^\d+$/.test(field)) return [Number.parseInt(field, 10)];

      throw new Error(`Unsupported cron field: ${field}`);
    };

    // Expand all components
    const minutes = expandField(components.minute, 59);
    const hours = expandField(components.hour, 23);
    const days = expandField(components.day, 31);
    const months = expandField(components.month, 12);
    const weekdays = expandField(components.weekday, 7);

    // If only minute uses "*/n" and everything else is wildcard, use StartInterval
    if (
      components.minute.startsWith('*/') &&
      components.hour === '*' &&
      components.day === '*' &&
      components.month === '*' &&
      components.weekday === '*'
    ) {
      const intervalSeconds = Number.parseInt(components.minute.slice(2), 10) * 60;
      return `    <key>StartInterval</key>\n    <integer>${intervalSeconds}</integer>`;
    }

    // Generate all combinations for StartCalendarInterval
    const arrayEntries: string[] = [];

    const hoursList = hours.length ? hours : [undefined];
    const minutesList = minutes.length ? minutes : [undefined];
    const daysList = days.length ? days : [undefined];
    const monthsList = months.length ? months : [undefined];
    const weekdaysList = weekdays.length ? weekdays : [undefined];

    for (const h of hoursList) {
      for (const m of minutesList) {
        for (const d of daysList) {
          for (const mo of monthsList) {
            for (const w of weekdaysList) {
              const dictEntries: string[] = [];
              if (h !== undefined) dictEntries.push(`        <key>Hour</key>\n        <integer>${h}</integer>`);
              if (m !== undefined) dictEntries.push(`        <key>Minute</key>\n        <integer>${m}</integer>`);
              if (d !== undefined) dictEntries.push(`        <key>Day</key>\n        <integer>${d}</integer>`);
              if (mo !== undefined) dictEntries.push(`        <key>Month</key>\n        <integer>${mo}</integer>`);
              if (w !== undefined) dictEntries.push(`        <key>Weekday</key>\n        <integer>${w}</integer>`);
              arrayEntries.push(`    <dict>\n${dictEntries.join('\n')}\n    </dict>`);
            }
          }
        }
      }
    }

    return `    <key>StartCalendarInterval</key>\n    <array>\n${arrayEntries.join('\n')}\n    </array>`;
  }

  private buildEnvironmentVariables(env?: Record<string, string>): string {
    if (!env || Object.keys(env).length === 0) {
      return '';
    }

    const entries = Object.entries(env)
      .map(
        ([key, value]) =>
          `        <key>${this.escapeXml(key)}</key>\n        <string>${this.escapeXml(value)}</string>`,
      )
      .join('\n');

    return `    <key>EnvironmentVariables</key>
    <dict>
${entries}
    </dict>
`;
  }

  private buildMetadataDict(metadata: Record<string, string>): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return '';
    }

    const entries = Object.entries(metadata)
      .map(
        ([key, value]) =>
          `        <key>${this.escapeXml(key)}</key>\n        <string>${this.escapeXml(value)}</string>`,
      )
      .join('\n');

    return `    <key>metadata</key>
    <dict>
${entries}
    </dict>
`;
  }
}
