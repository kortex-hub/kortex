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

import { expect, test } from '/@/fixtures/provider-fixtures';
import { waitForNavigationReady } from '/@/utils/app-ready';

test.describe('Knowledge Databases page - empty state', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page }) => {
    await waitForNavigationReady(page);
  });

  test('[KDB-01] Knowledge Databases page shows empty state when no knowledge databases exist', async ({
    workerNavigationBar,
  }) => {
    const knowledgePage = await workerNavigationBar.navigateToKnowledgePage();
    await expect(knowledgePage.heading).toBeVisible();
    await expect(knowledgePage.noEnvironmentsMessage).toHaveText('No knowledge databases are currently configured.');
    await expect(knowledgePage.table).not.toBeVisible();
  });

  test('[KDB-11] Cancelling the New Knowledge Base modal discards the draft', async ({ workerNavigationBar }) => {
    const knowledgePage = await workerNavigationBar.navigateToKnowledgePage();
    const createPage = await knowledgePage.openCreatePage();

    await expect(createPage.heading).toBeVisible();
    await createPage.fillName('discarded-knowledge-base');
    await createPage.cancel();

    await expect(knowledgePage.noEnvironmentsMessage).toBeVisible();
    await expect(knowledgePage.table).not.toBeVisible();
  });
});
