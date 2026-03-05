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

function attach(testInfo: TestInfo, name: string, path: string, contentType: string): void {
  if (existsSync(path)) {
    testInfo.attachments.push({ name, path, contentType });
  }
}

export async function saveTestArtifacts(page: Page, testInfo: TestInfo): Promise<void> {
  const context = page.context();
  const failed = testInfo.status !== testInfo.expectedStatus;

  if (failed) {
    const tracePath = testInfo.outputPath('trace.zip');
    await context.tracing.stopChunk({ path: tracePath }).catch(() => {});
    attach(testInfo, 'trace', tracePath, 'application/zip');

    const screenshotPath = testInfo.outputPath('failure.png');
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch((error: unknown) => {
      console.error('Failed to capture failure screenshot:', error);
    });
    attach(testInfo, 'screenshot', screenshotPath, 'image/png');
  } else {
    await context.tracing.stopChunk().catch(() => {});
  }

  // saveAs() is safe to call while the page is still open — it copies the
  // recording captured so far without waiting for page/context closure.
  // Only video.delete() blocks until the page closes.
  const video = page.video();
  if (video && failed) {
    const videoPath = testInfo.outputPath('video.webm');
    await video.saveAs(videoPath).catch(() => {});
    attach(testInfo, 'video', videoPath, 'video/webm');
  }
}
