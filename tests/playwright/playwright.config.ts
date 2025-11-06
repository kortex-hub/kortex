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
import type { PlaywrightTestConfig } from '@playwright/test';

import type { ResourceId } from './src/model/core/types';

const config: PlaywrightTestConfig & {
  projects?: Array<{
    use?: { resource?: ResourceId };
    [key: string]: unknown;
  }>;
} = {
  testDir: './src',
  timeout: 180_000,

  workers: 1,

  reporter: [
    ['html', { outputFolder: './output/html-report' }],
    ['json', { outputFile: './output/test-results.json' }],
    ['junit', { outputFile: './output/junit-results.xml' }],
    ['list'],
  ],

  use: {
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  preserveOutput: 'always',

  projects: [
    {
      name: 'Kortex-App-Core',
      testMatch: ['**/*.spec.ts'],
      testIgnore: ['**/provider-specs/*.spec.ts'],
    },
    {
      name: 'Gemini-Provider',
      testMatch: ['**/provider-specs/*.spec.ts'],
      use: {
        resource: 'gemini',
      },
      testIgnore: process.env.GEMINI_API_KEY ? [] : ['**/*'], // Skip if GEMINI_API_KEY is not set
    },
    {
      name: 'OpenAI-Provider',
      testMatch: ['**/provider-specs/*.spec.ts'],
      use: {
        resource: 'openai',
      },
      testIgnore: ['**/*'], // Disabled until OpenAI resource creation is implemented
    },
    {
      name: 'OpenShift-AI-Provider',
      testMatch: ['**/provider-specs/*.spec.ts'],
      use: {
        resource: 'openshift-ai',
      },
      testIgnore: ['**/*'], // Disabled until OpenShift AI resource creation is implemented
    },
  ],

  outputDir: './output/test-results',
};

export default config;
