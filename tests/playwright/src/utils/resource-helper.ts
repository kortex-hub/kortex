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
import type { SettingsResourceId } from 'src/model/core/types';

export interface ResourceConfig {
  readonly envVarName: string;
  readonly resourceId: SettingsResourceId;
}

export const PROVIDERS = {
  gemini: {
    envVarName: 'GEMINI_API_KEY',
    resourceId: 'gemini',
  },
  openai: {
    envVarName: 'OPENAI_API_KEY',
    resourceId: 'openai',
  },
  'openshift-ai': {
    envVarName: 'OPENSHIFT_AI_TOKEN',
    resourceId: 'openshiftai',
  },
} as const satisfies Record<string, ResourceConfig>;

export type ResourceId = keyof typeof PROVIDERS;

export function getProviderCredentials(providerId: ResourceId): string | undefined {
  const provider = PROVIDERS[providerId];
  return process.env[provider.envVarName];
}

export function hasApiKey(providerId: ResourceId): boolean {
  return !!getProviderCredentials(providerId);
}
