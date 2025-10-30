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

import { inject, injectable } from 'inversify';
import { parse } from 'yaml';

import { ProviderRegistry } from '../provider-registry.js';

interface ParsedFlowContent {
  settings?: {
    goose_provider?: string;
    goose_model?: string;
  };
  extensions?: Array<{ name?: string; headers?: Record<string, string> }>;
}

@injectable()
export class FlowSecretCollector {
  // Map goose provider names to kortex provider IDs
  // TODO: Move to shared location
  private readonly GOOSE_TO_KORTEX_PROVIDER_MAP: Record<string, string> = {
    google: 'gemini',
  };

  constructor(@inject(ProviderRegistry) private providerRegistry: ProviderRegistry) {}

  /**
   * Collects all secret values used by a specific flow
   * @param flowId - The flow identifier
   * @param flowProviderId - The flow provider ID
   * @param connectionName - The connection name
   * @returns Array of secret values
   */
  async collectSecretsForFlow(flowId: string, flowProviderId: string, connectionName: string): Promise<string[]> {
    try {
      const flowProvider = this.providerRegistry.getProvider(flowProviderId);
      const flowConnection = flowProvider.flowConnections.find(({ name }) => name === connectionName);

      if (!flowConnection) {
        console.warn(`[FlowSecretCollector] Flow connection ${connectionName} not found`);
        return [];
      }

      const flowContent = await flowConnection.flow.read(flowId);
      const parsed = parse(flowContent) as ParsedFlowContent;

      // Collect secrets from different sources
      const providerSecrets = await this.collectProviderCredentials(parsed);
      const mcpSecrets = this.collectMCPHeaders(parsed);

      return [...providerSecrets, ...mcpSecrets];
    } catch (error) {
      console.error(`[FlowSecretCollector] Failed to collect secrets for flow ${flowId}:`, error);
      return [];
    }
  }

  /**
   * Collects credentials from inference providers referenced in the flow
   * @param parsed - The parsed flow YAML content
   * @returns Array of credential values
   */
  private async collectProviderCredentials(parsed: ParsedFlowContent): Promise<string[]> {
    const secrets: string[] = [];

    if (!parsed.settings?.goose_provider) {
      return secrets;
    }

    // Map goose provider name to kortex provider ID
    const inferenceProviderId = this.GOOSE_TO_KORTEX_PROVIDER_MAP[parsed.settings.goose_provider];
    if (!inferenceProviderId) {
      return secrets;
    }

    // Get all inference connections for this provider
    const inferenceConnections = this.providerRegistry
      .getInferenceConnections()
      .filter(ic => ic.providerId === inferenceProviderId);

    for (const inferenceConnection of inferenceConnections) {
      try {
        const credentials = inferenceConnection.connection.credentials();
        const credentialValues = Object.values(credentials).filter((v): v is string => typeof v === 'string');
        secrets.push(...credentialValues);
      } catch (error) {
        console.warn(
          `[FlowSecretCollector] Failed to get credentials for inference connection ${inferenceConnection.connection.name}:`,
          error,
        );
      }
    }

    return secrets;
  }

  /**
   * Collects header values from MCP extensions in the flow
   * @param parsed - The parsed flow YAML content
   * @returns Array of header values
   */
  private collectMCPHeaders(parsed: ParsedFlowContent): string[] {
    const secrets: string[] = [];

    if (!parsed.extensions) {
      return secrets;
    }

    for (const extension of parsed.extensions) {
      if (extension.headers) {
        const headerValues = Object.values(extension.headers).filter(
          (value): value is string => typeof value === 'string',
        );
        secrets.push(...headerValues);
      }
    }

    return secrets;
  }
}
