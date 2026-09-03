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
 ***********************************************************************/

import { existsSync } from 'node:fs';

import type { Page, TestInfo } from '@playwright/test';

import { TIMEOUTS } from '/@/model/core/types';

function attach(testInfo: TestInfo, name: string, path: string, contentType: string): void {
  if (existsSync(path)) {
    testInfo.attachments.push({ name, path, contentType });
  }
}

// A degraded CDP connection (e.g. after the app enters a broken state) can leave these
// calls pending forever rather than rejecting, and their own .catch() only handles
// rejection — so bound each step or a single stuck artifact stalls the whole test teardown.
// Clears its timer once either side settles, and annotates the test report (rather than just
// logging) so a degraded connection isn't silently swallowed as a routine missing artifact.
function withTimeout(promise: Promise<unknown>, label: string, testInfo: TestInfo): Promise<unknown> {
  let timer: NodeJS.Timeout;
  const timedOut = new Promise(resolve => {
    timer = setTimeout(() => {
      testInfo.annotations.push({
        type: 'warning',
        description: `${label} did not settle within ${TIMEOUTS.SHORT}ms, skipped`,
      });
      resolve(undefined);
    }, TIMEOUTS.SHORT);
  });
  return Promise.race([promise, timedOut]).finally(() => clearTimeout(timer));
}

export async function saveTestArtifacts(page: Page, testInfo: TestInfo): Promise<void> {
  const context = page.context();
  const failed = testInfo.status !== testInfo.expectedStatus;

  if (!failed) {
    await withTimeout(
      context.tracing.stopChunk().catch(() => {}),
      'trace',
      testInfo,
    );
    return;
  }

  // These touch independent resources (tracing context, page, video file) with no
  // dependency on each other, so save them concurrently instead of paying their sum.
  const tracePath = testInfo.outputPath('trace.zip');
  const screenshotPath = testInfo.outputPath('failure.png');
  const video = page.video();
  const videoPath = video ? testInfo.outputPath('video.webm') : undefined;

  const tasks = [
    withTimeout(
      context.tracing.stopChunk({ path: tracePath }).catch(() => {}),
      'trace',
      testInfo,
    ),
    withTimeout(
      page.screenshot({ path: screenshotPath, fullPage: true }).catch((error: unknown) => {
        console.error('Failed to capture failure screenshot:', error);
      }),
      'screenshot',
      testInfo,
    ),
  ];
  // saveAs() is safe to call while the page is still open — it copies the recording
  // captured so far without waiting for page/context closure. Only video.delete() blocks
  // until the page closes.
  if (video && videoPath) {
    tasks.push(
      withTimeout(
        video.saveAs(videoPath).catch(() => {}),
        'video',
        testInfo,
      ),
    );
  }
  await Promise.all(tasks);

  attach(testInfo, 'trace', tracePath, 'application/zip');
  attach(testInfo, 'screenshot', screenshotPath, 'image/png');
  if (video && videoPath) {
    attach(testInfo, 'video', videoPath, 'video/webm');
  }
}
