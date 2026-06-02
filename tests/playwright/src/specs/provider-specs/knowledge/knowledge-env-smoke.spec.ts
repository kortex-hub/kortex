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

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '../../../fixtures/provider-fixtures';
import { TIMEOUTS } from '../../../model/core/types';
import { waitForNavigationReady } from '../../../utils/app-ready';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_FILE_PATH = resolve(__dirname, '../../../../resources/test-doc.pdf');

const VECTOR_STORE_NAME = 'e2e-milvus';
const EMBEDDING_MODEL_NAME = 'docling';

test.use({ milvusConnectionName: VECTOR_STORE_NAME, doclingConnectionName: EMBEDDING_MODEL_NAME });

test.describe('Knowledge Database provider tests', () => {
  test.skip(
    process.platform !== 'linux' && !process.env.PODMAN_ENABLED,
    'Knowledge Database tests require Podman (set PODMAN_ENABLED=true on non-Linux)',
  );

  test.beforeEach(async ({ page }) => {
    await waitForNavigationReady(page);
  });

  test.describe
    .serial('Knowledge Database page - UI creation', { tag: '@knowledge-provider' }, () => {
      const ENVIRONMENT_NAME = 'test-knowledge-base';

      test('[KDB-02] Create knowledge database via UI and verify row appears', async ({
        milvusSetup: vectorStoreName,
        doclingSetup: _doclingSetup,
        workerNavigationBar,
      }) => {
        const knowledgePage = await workerNavigationBar.navigateToKnowledgePage();
        await knowledgePage.createEnvironment(ENVIRONMENT_NAME, vectorStoreName, EMBEDDING_MODEL_NAME);
      });

      test('[KDB-03] Details page shows all tabs and Sources tab has zero files', async ({ workerNavigationBar }) => {
        const knowledgePage = await workerNavigationBar.navigateToKnowledgePage();
        const detailsPage = await knowledgePage.openEnvironmentDetails(ENVIRONMENT_NAME);
        await detailsPage.waitForLoad();

        await expect(detailsPage.heading).toContainText(ENVIRONMENT_NAME);
        await expect(detailsPage.summaryTabLink).toBeVisible();
        await expect(detailsPage.sourcesTabLink).toBeVisible();
        await expect(detailsPage.vectorStoreTabLink).toBeVisible();
        await expect(detailsPage.chunkerTabLink).toBeVisible();

        await detailsPage.switchToSourcesTab();
        await expect(detailsPage.uploadedFilesHeader).toContainText('0');
      });

      test('[KDB-04] Upload a file and verify it appears in Sources tab', async ({
        workerElectronApp,
        workerNavigationBar,
      }) => {
        const knowledgePage = await workerNavigationBar.navigateToKnowledgePage();
        const detailsPage = await knowledgePage.openEnvironmentDetails(ENVIRONMENT_NAME);
        await detailsPage.waitForLoad();
        await detailsPage.switchToSourcesTab();

        await detailsPage.uploadFile(TEST_FILE_PATH, workerElectronApp);

        await expect(detailsPage.getUploadedFile('test-doc.pdf')).toBeVisible();
        await expect(detailsPage.uploadedFilesHeader).toContainText('1');
        await expect(detailsPage.getUploadedFileRow('test-doc.pdf')).toContainText('pending');
      });

      test('[KDB-05] Delete knowledge database from details page', async ({ workerNavigationBar }) => {
        const knowledgePage = await workerNavigationBar.navigateToKnowledgePage();
        const detailsPage = await knowledgePage.openEnvironmentDetails(ENVIRONMENT_NAME);
        await detailsPage.waitForLoad();

        const listPage = await detailsPage.deleteEnvironment();
        await listPage.waitForLoad();
        await listPage.ensureRowDoesNotExist(ENVIRONMENT_NAME);
      });
    });

  test.describe
    .serial('Knowledge Database Pipeline with Milvus', { tag: '@knowledge-provider' }, () => {
      const ENVIRONMENT_NAME = 'connected-knowledge-base';
      const EXPECTED_COLLECTION_NAME = 'connected_knowledge_base';

      test('[KDB-06] Milvus connection is visible in Settings Resources', async ({
        milvusSetup: _milvusSetup,
        workerNavigationBar,
      }) => {
        const settingsPage = await workerNavigationBar.navigateToSettingsPage();
        const resourcesPage = await settingsPage.openResources();
        await resourcesPage.waitForLoad();

        const milvusRegion = resourcesPage.getProviderRegion('milvus');
        await expect(milvusRegion).toBeVisible();

        const connection = resourcesPage.getCreatedConnectionFor('milvus', 'rag');
        await expect(connection).toBeVisible();
      });

      test('[KDB-07] Create knowledge database via UI and verify it appears', async ({
        milvusSetup: vectorStoreName,
        doclingSetup: _doclingSetup,
        workerNavigationBar,
      }) => {
        const knowledgePage = await workerNavigationBar.navigateToKnowledgePage();
        await knowledgePage.createEnvironment(ENVIRONMENT_NAME, vectorStoreName, EMBEDDING_MODEL_NAME);
      });

      test('[KDB-08] Details page shows Milvus info in Summary and VectorStore tabs', async ({
        milvusSetup: vectorStoreName,
        workerNavigationBar,
      }) => {
        const knowledgePage = await workerNavigationBar.navigateToKnowledgePage();
        const detailsPage = await knowledgePage.openEnvironmentDetails(ENVIRONMENT_NAME);
        await detailsPage.waitForLoad();

        await detailsPage.switchToSummaryTab();
        await expect(detailsPage.getInfoValue('Vector Store')).toContainText(vectorStoreName, {
          timeout: TIMEOUTS.DEFAULT,
        });

        await detailsPage.switchToVectorStoreTab();
        await expect(detailsPage.getInfoRow('Database Type')).toBeVisible({ timeout: TIMEOUTS.DEFAULT });
        await expect(detailsPage.getInfoValue('Collection Name')).toHaveText(EXPECTED_COLLECTION_NAME, {
          timeout: TIMEOUTS.DEFAULT,
        });
      });

      test('[KDB-09] Delete knowledge database from details page', async ({ workerNavigationBar }) => {
        const knowledgePage = await workerNavigationBar.navigateToKnowledgePage();
        const detailsPage = await knowledgePage.openEnvironmentDetails(ENVIRONMENT_NAME);
        await detailsPage.waitForLoad();

        const listPage = await detailsPage.deleteEnvironment();
        await listPage.waitForLoad();
        await listPage.ensureRowDoesNotExist(ENVIRONMENT_NAME);
      });
    });
});
