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

import type { FlowsPage } from 'src/model/pages/flows-page';

import { expect, test } from '../../fixtures/provider-fixtures';
import { waitForNavigationReady } from '../../utils/app-ready';

const flowName = 'custom-flow-smoke-test';
let flowsPage: FlowsPage;

test.skip(!!process.env.CI, 'Skipping flow tests on CI');

test.beforeAll(async ({ page, navigationBar }) => {
  await waitForNavigationReady(page);
  flowsPage = await navigationBar.navigateToFlowsPage();
});

test.describe.serial('Flow page e2e test suite', { tag: '@smoke' }, () => {
  test('[FLOW-01] Check that Flows page is displayed and empty', async () => {
    await expect.poll(async () => flowsPage.checkIfFlowsPageIsEmpty()).toBeTruthy();
  });

  test('[FLOW-02] Check that user can create a new flow', async ({ navigationBar }) => {
    await flowsPage.createFlow(flowName, {
      prompt:
        'write a typescript recursive method that calculates the fibonacci number for a given index without using memoization',
    });
    flowsPage = await navigationBar.navigateToFlowsPage();
    await flowsPage.ensureRowExists(flowName, 30_000, false);
  });

  test('[FLOW-03] Check that user can run the created flow and validate the results', async () => {
    const flowDetailsPage = await flowsPage.openFlowDetailsPageByName(flowName);
    await flowDetailsPage.waitForLoad();

    await flowDetailsPage.runFlow();
    await flowDetailsPage.switchToRunTab();

    await expect(flowDetailsPage.terminalContent).toContainText(
      /([a-zA-Z_]\w*)\(\s*n\s*-\s*1\s*\)\s*\+\s*\1\(\s*n\s*-\s*2\s*\)/,
      { timeout: 120_000 },
    );
  });

  test('[FLOW-04] Check that user can delete the created flow', async ({ navigationBar }) => {
    flowsPage = await navigationBar.navigateToFlowsPage();
    await flowsPage.deleteFlowByName(flowName);
    await flowsPage.ensureRowDoesNotExist(flowName, 30_000, false);
  });
});
