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

import {
  AGENT_MODEL_SETUPS,
  CODING_AGENT,
  type CodingAgent,
  PROVIDERS,
  type WorkspaceInferenceProviderConfig,
  type WorkspaceInferenceProviderId,
} from '/@/model/core/types';

export interface InlineConnectionField {
  label: string;
  value: string;
}

export interface ResolvedAgentModelSetup {
  agent: CodingAgent;
  providerName: string;
  fields: InlineConnectionField[];
}

function getWorkspaceInferenceProvider(providerId: WorkspaceInferenceProviderId): WorkspaceInferenceProviderConfig {
  return PROVIDERS[providerId] as WorkspaceInferenceProviderConfig;
}

export function buildInlineConnectionFields(providerId: WorkspaceInferenceProviderId): InlineConnectionField[] {
  const provider = getWorkspaceInferenceProvider(providerId);

  return provider.inlineConnectionFields.map(field => {
    const value = field.useBaseURL ? provider.baseURL : field.useEnvVar ? process.env[provider.envVarName] : undefined;
    if (!value) {
      throw new Error(`Missing value for inline connection field "${field.label}" on provider "${providerId}"`);
    }
    return { label: field.label, value };
  });
}

export function resolveAgentModelConnectionFor(agent: CodingAgent): ResolvedAgentModelSetup | undefined {
  const setup = AGENT_MODEL_SETUPS.find(entry => entry.agent === agent);
  if (!setup) {
    return undefined;
  }
  const provider = getWorkspaceInferenceProvider(setup.providerId);
  if (!process.env[provider.envVarName]) {
    return undefined;
  }
  return {
    agent: setup.agent,
    providerName: provider.providerPickerName,
    fields: buildInlineConnectionFields(setup.providerId),
  };
}

export function resolveAgentModelConnection(): ResolvedAgentModelSetup | undefined {
  for (const setup of AGENT_MODEL_SETUPS) {
    const connection = resolveAgentModelConnectionFor(setup.agent);
    if (connection) {
      return connection;
    }
  }
  return undefined;
}

export function agentModelSetupSkipMessage(): string {
  const envVars = AGENT_MODEL_SETUPS.map(setup => getWorkspaceInferenceProvider(setup.providerId).envVarName).join(
    ', ',
  );
  return `One of ${envVars} is required for workspace wizard model step`;
}

export function isOpenCodeModelSetupAvailable(): boolean {
  return !!process.env[PROVIDERS.ollama.envVarName] || !!process.env[PROVIDERS.ramalama.envVarName];
}

export function isAgentModelSetupAvailable(agent: CodingAgent): boolean {
  if (agent === CODING_AGENT.OPENCODE) {
    return isOpenCodeModelSetupAvailable();
  }
  return resolveAgentModelConnectionFor(agent) !== undefined;
}

export function agentModelSetupSkipMessageFor(agent: CodingAgent): string {
  if (agent === CODING_AGENT.OPENCODE) {
    return `${PROVIDERS.ollama.envVarName} or ${PROVIDERS.ramalama.envVarName} is required for OpenCode model setup`;
  }
  const setup = AGENT_MODEL_SETUPS.find(entry => entry.agent === agent);
  if (setup) {
    return `${PROVIDERS[setup.providerId].envVarName} is required for ${agent} model setup`;
  }
  return `${agent} is not supported`;
}
