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

import type { InferenceProviderConnectionType, LLMMetadata, ProviderConnectionStatus } from '@openkaiden/api';

export interface ModelInfo {
  providerId: string;
  connectionId: string;
  connectionName: string;
  type: InferenceProviderConnectionType;
  llmMetadata?: LLMMetadata;
  endpoint?: string;
  label: string;
}

export interface CatalogModelInfo extends ModelInfo {
  connectionStatus: ProviderConnectionStatus;
  providerName: string;
}

export interface InferenceConnectionSummary {
  providerName: string;
  providerId: string;
  providerInternalId: string;
  connectionId: string;
  connectionName: string;
  connectionType?: InferenceProviderConnectionType;
  status: ProviderConnectionStatus | 'not-configured';
  modelCount: number;
  creationDisplayName: string;
  configurable: boolean;
}
