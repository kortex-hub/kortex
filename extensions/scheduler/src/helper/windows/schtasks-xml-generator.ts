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

export interface SchtasksXmlOptions {
  id: string;
  metadata: Record<string, string>;
  executorScript: string;
  storageDir: string;
  command: ProviderSchedulerCommand;
  outputFile: string;
  cronComponents: CronComponents;
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

    const triggers = this.buildTriggers(cronComponents);
    const actions = this.buildActions(executorScript, allArgs, command.env);
    const registrationInfo = this.buildRegistrationInfo(id, metadata);

    const xml = `<?xml version="1.0"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
${registrationInfo}
  <Triggers>
${triggers}
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
${actions}
  </Actions>
</Task>
`;

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

  private buildTriggers(components: CronComponents): string {
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
      return `    <TimeTrigger>
      <Repetition>
        <Interval>PT${intervalMinutes}M</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <StartBoundary>2025-01-01T00:00:00</StartBoundary>
      <Enabled>true</Enabled>
    </TimeTrigger>`;
    }

    // For complex schedules, create CalendarTrigger with ScheduleByDay/Week/Month
    const minutes = expandField(components.minute, 59);
    const hours = expandField(components.hour, 23);
    const days = expandField(components.day, 31);
    const weekdays = expandField(components.weekday, 7);

    // Generate triggers for each time combination
    const triggers: string[] = [];

    const hoursList = hours.length ? hours : [0];
    const minutesList = minutes.length ? minutes : [0];

    for (const h of hoursList) {
      for (const m of minutesList) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

        if (weekdays.length > 0) {
          // Weekly trigger
          const daysOfWeek = weekdays.map(w => this.getDayOfWeekName(w)).join('');
          triggers.push(`    <CalendarTrigger>
      <StartBoundary>2025-01-01T${time}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByWeek>
        <DaysOfWeek>
          ${daysOfWeek}
        </DaysOfWeek>
        <WeeksInterval>1</WeeksInterval>
      </ScheduleByWeek>
    </CalendarTrigger>`);
        } else if (days.length > 0) {
          // Monthly trigger with specific days
          const daysXml = days.map(d => `<Day>${d}</Day>`).join('\n          ');
          triggers.push(`    <CalendarTrigger>
      <StartBoundary>2025-01-01T${time}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth>
          ${daysXml}
        </DaysOfMonth>
        <Months>
          <January /><February /><March /><April /><May /><June />
          <July /><August /><September /><October /><November /><December />
        </Months>
      </ScheduleByMonth>
    </CalendarTrigger>`);
        } else {
          // Daily trigger
          triggers.push(`    <CalendarTrigger>
      <StartBoundary>2025-01-01T${time}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>`);
        }
      }
    }

    return triggers.join('\n');
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

  private buildActions(executorScript: string, args: string, env?: Record<string, string>): string {
    // Convert env to JSON string and escape quotes
    let envArgs = '';
    if (env && Object.keys(env).length > 0) {
      const envJson = JSON.stringify(env).replace(/"/g, '\\"'); // Escape quotes for command line
      envArgs = ` -envJson "${envJson}"`;
    }

    return `    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-NoProfile -NoLogo -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -file ${executorScript} ${args}${envArgs}</Arguments>
    </Exec>`;
  }

  private buildRegistrationInfo(id: string, metadata: Record<string, string>): string {
    const metadataXml = Object.entries(metadata)
      .map(([key, value]) => `      <${this.escapeXml(key)}>${this.escapeXml(value)}</${this.escapeXml(key)}>`)
      .join('\n');

    return `  <RegistrationInfo>
    <Description><![CDATA[
  <Metadata>
    <Name>Kortex scheduled task: ${id}</Name>
${metadataXml}
  </Metadata>
]]></Description>
    <URI>\\Kortex\\${this.escapeXml(id)}</URI>
  </RegistrationInfo>`;
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
