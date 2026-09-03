/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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
 *
 * Compact terminal reporter for long workspace E2E titles.
 * Prints test.title only (no file path, describe chain, or tags) so
 * semantic step IDs are not truncated by fitToWidth in the list reporter.
 ***********************************************************************/

import type { FullConfig, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

const POSITIVE_MARK = process.platform === 'win32' && process.env.TERM_PROGRAM !== 'vscode' ? 'ok' : '\u2713';
const NEGATIVE_MARK = process.platform === 'win32' && process.env.TERM_PROGRAM !== 'vscode' ? 'x' : '\u2718';

const DESCRIBE_AGENT_TO_WKS: Record<string, string> = {
  OpenCode: 'WKS-OPENAI',
  'Claude Code': 'WKS-CLAUDE',
};

function resolveWksLabel(test: TestCase): string {
  for (const segment of test.titlePath().slice(3, -1)) {
    const wks = DESCRIBE_AGENT_TO_WKS[segment];
    if (wks) {
      return wks;
    }
  }

  const parsed = parseBracketedId(test.title);
  if (parsed?.id.startsWith('WKS-')) {
    const agent = parsed.id.slice(4).split('-')[0];
    if (agent) {
      return `WKS-${agent}`;
    }
  }

  return 'WKS';
}

function parseBracketedId(title: string): { id: string; action: string } | undefined {
  if (!title.startsWith('[')) {
    return undefined;
  }
  const close = title.indexOf(']');
  if (close < 0) {
    return undefined;
  }
  return { id: title.slice(1, close), action: title.slice(close + 1).trim() };
}

function scenarioIdFromPath(test: TestCase): string | undefined {
  for (const segment of test.titlePath().slice(3, -1)) {
    if (segment.startsWith('FS-')) {
      return segment;
    }
  }
  return undefined;
}

function compactStepLabel(title: string): string {
  const parsed = parseBracketedId(title);
  if (parsed?.id.length === 2 && parsed.id >= '00' && parsed.id <= '99') {
    return parsed.action;
  }
  return title;
}

/** e.g. OpenCode › FS-NONE-NET-DEVELOPER › [01] creation → WKS-OPENAI [FS-NONE-NET-DEVELOPER] creation */
function formatCompactTitle(test: TestCase): string {
  const wks = resolveWksLabel(test);

  if (test.title.startsWith('[SKIP] ')) {
    const rest = test.title.slice('[SKIP] '.length);
    const dash = rest.indexOf(' — ');
    if (dash > 0) {
      return `${wks} [${rest.slice(0, dash)}] skip — ${rest.slice(dash + 3)}`;
    }
  }

  const scenarioId = scenarioIdFromPath(test);
  if (scenarioId) {
    return `${wks} [${scenarioId}] ${compactStepLabel(test.title)}`;
  }

  return test.title;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function statusMark(result: TestResult, expectedStatus: TestResult['status']): string {
  if (result.status === 'skipped') {
    return '-';
  }
  if (result.status === expectedStatus) {
    return POSITIVE_MARK;
  }
  return NEGATIVE_MARK;
}

class CompactListReporter implements Reporter {
  private totalTestCount = 0;
  private completedCount = 0;
  private indexWidth = 1;
  private passed = 0;
  private skipped = 0;
  private failed = 0;

  onBegin(config: FullConfig, suite: Suite): void {
    this.totalTestCount = suite.allTests().length;
    this.indexWidth = Math.max(1, String(this.totalTestCount).length);
    if (process.argv.includes('--list')) {
      return;
    }
    const workers = config.metadata.actualWorkers ?? config.workers;
    if (this.totalTestCount > 0) {
      process.stdout.write(
        `\nRunning ${this.totalTestCount} test${this.totalTestCount === 1 ? '' : 's'} using ${workers} worker${workers === 1 ? '' : 's'}\n\n`,
      );
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.completedCount += 1;
    if (result.status === 'skipped') {
      this.skipped += 1;
    } else if (result.status === test.expectedStatus) {
      this.passed += 1;
    } else {
      this.failed += 1;
    }

    const mark = statusMark(result, test.expectedStatus);
    const index = String(this.completedCount).padStart(this.indexWidth);
    const duration = result.status === 'skipped' ? '' : ` (${formatDuration(result.duration)})`;
    const retry = result.retry ? ` (retry #${result.retry})` : '';
    const label = formatCompactTitle(test);
    process.stdout.write(`  ${mark} ${index} ${label}${retry}${duration}\n`);
  }

  async onEnd(): Promise<void> {
    process.stdout.write('\n');
    const lines: string[] = [];
    if (this.failed) {
      lines.push(`${this.failed} failed`);
    }
    if (this.skipped) {
      lines.push(`${this.skipped} skipped`);
    }
    if (this.passed) {
      lines.push(`${this.passed} passed`);
    }
    if (lines.length) {
      process.stdout.write(`  ${lines.join('\n  ')}\n`);
    }
  }

  printsToStdio(): boolean {
    return true;
  }
}

export default CompactListReporter;
