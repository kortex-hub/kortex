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

import { TIMEOUTS } from 'src/model/core/types';

import { expect, test } from '../../fixtures/provider-fixtures';
import { waitForNavigationReady } from '../../utils/app-ready';

const flowName = 'custom-flow-smoke-test';
const flowNameFromContentRegion = 'custom-flow-content-region-test';

test.skip(!!process.env.CI, 'Skipping flow tests on CI');

test.beforeAll(async ({ page, navigationBar, flowsPage }) => {
  await waitForNavigationReady(page);
  await navigationBar.navigateToFlowsPage();
  await flowsPage.deleteAllFlows(TIMEOUTS.STANDARD);
});

test.afterAll(async ({ navigationBar, flowsPage }) => {
  await navigationBar.navigateToFlowsPage();
  await flowsPage.deleteAllFlows(TIMEOUTS.STANDARD);
});

test.describe.serial('Flow page e2e test suite', { tag: '@smoke' }, () => {
  test('[FLOW-01] Check that Flows page is displayed and empty', async ({ flowsPage }) => {
    await expect.poll(async () => flowsPage.checkIfFlowsPageIsEmpty()).toBeTruthy();
  });

  test('[FLOW-02] Check that user can create a new flow', async ({ navigationBar, flowsPage }) => {
    await flowsPage.createFlow(flowName, {
      prompt:
        'write a typescript recursive method that calculates the fibonacci number for a given index without using memoization',
    });
    await navigationBar.navigateToFlowsPage();
    await flowsPage.ensureRowExists(flowName, TIMEOUTS.STANDARD, false);
  });

  test('[FLOW-03] Check that user can run the created flow and validate the results', async ({ flowsPage }) => {
    const flowDetailsPage = await flowsPage.openFlowDetailsPageByName(flowName);
    await flowDetailsPage.waitForLoad();

    await flowDetailsPage.runFlow();
    await flowDetailsPage.switchToRunTab();

    await flowDetailsPage.waitForTerminalContent(
      /([a-zA-Z_]\w*)\(\s*n\s*-\s*1\s*\)\s*\+\s*\1\(\s*n\s*-\s*2\s*\)/,
      TIMEOUTS.DEFAULT,
    );
  });

  test('[FLOW-04] Check that user can delete the created flow', async ({ navigationBar, flowsPage }) => {
    await navigationBar.navigateToFlowsPage();
    await flowsPage.deleteFlowByName(flowName);
    await flowsPage.ensureRowDoesNotExist(flowName, TIMEOUTS.STANDARD, false);
  });

  test('[FLOW-05] Check that user can create a new flow from content region', async ({ navigationBar, flowsPage }) => {
    await expect.poll(async () => await flowsPage.checkIfFlowsPageIsEmpty()).toBeTruthy();
    await flowsPage.createFlowFromContentRegion(flowNameFromContentRegion);
    await navigationBar.navigateToFlowsPage();
    await flowsPage.ensureRowExists(flowNameFromContentRegion, TIMEOUTS.STANDARD, false);
  });
});
