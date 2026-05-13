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

import type { IconDefinition } from '@fortawesome/fontawesome-common-types';
import { faClaude, faGoogle } from '@fortawesome/free-brands-svg-icons';
import { faDesktop, faRobot, faWrench } from '@fortawesome/free-solid-svg-icons';
import type { Component } from 'svelte';

import ClaudeCodeIcon from '/@/lib/images/agents/ClaudeCodeIcon.svelte';
import GooseIcon from '/@/lib/images/agents/GooseIcon.svelte';
import OpenClawIcon from '/@/lib/images/agents/OpenClawIcon.svelte';
import OpenCodeIcon from '/@/lib/images/agents/OpenCodeIcon.svelte';
import VertexAIIcon from '/@/lib/images/agents/VertexAIIcon.svelte';

import type { CliAgent } from './guided-setup-steps';
import ClaudePanel from './panels/ClaudePanel.svelte';
import ClaudeVertexPanel from './panels/ClaudeVertexPanel.svelte';
import OpenRuntimePanel from './panels/OpenRuntimePanel.svelte';

export interface AgentDefinition {
  cliName: CliAgent;
  /**
   * The CLI agent name used for filtering against `kdn info` output.
   * Allows UI variants (e.g. `claude-vertex`) to match their parent CLI agent (`claude`).
   * Falls back to {@link cliName} when omitted.
   */
  cliAgent?: string;
  title: string;
  icon: IconDefinition;
  iconComponent?: Component;
  colorClass: string;
  description?: string;
  badge?: string;
  panel?: Component;
  /** When set, filters models by `llmMetadata.name`. Prefix with `!` to exclude instead (e.g. `'!vertexai'`). */
  modelFilter?: string;
  /** Compound selector in the form `extensionId:providerId` (e.g. `kaiden.claude:claude`). */
  providerSelector?: string;
  secretType?: string;
  runtimes?: string[];
}

const DEFAULT_DEFINITION: Omit<AgentDefinition, 'cliName' | 'title'> = {
  icon: faRobot,
  colorClass: 'bg-gradient-to-br from-purple-500 to-purple-600',
};

export const agentDefinitions: AgentDefinition[] = [
  {
    cliName: 'opencode',
    title: 'OpenCode',
    icon: faDesktop,
    iconComponent: OpenCodeIcon,
    colorClass: 'bg-gradient-to-br from-green-500 to-green-600',
    description:
      'Open-source agent on your machine — local models via Ollama or Ramalama, or cloud APIs (OpenAI, Gemini, and other providers OpenCode supports).',
    badge: 'Recommended',
    panel: OpenRuntimePanel,
    modelFilter: '!vertexai',
  },
  {
    cliName: 'claude',
    title: 'Claude Code',
    description: 'Anthropic cloud agent — connect with an API key to access Claude models.',
    badge: 'Cloud',
    icon: faClaude,
    iconComponent: ClaudeCodeIcon,
    colorClass: 'bg-gradient-to-br from-amber-600 to-amber-500',
    modelFilter: 'anthropic',
    panel: ClaudePanel,
    providerSelector: 'kaiden.claude:claude',
    secretType: 'anthropic',
  },
  {
    cliName: 'claude-vertex',
    cliAgent: 'claude',
    title: 'Claude on Vertex AI',
    description: 'Run Claude Code through Google Cloud Vertex AI using your GCP project credentials.',
    badge: 'Vertex AI',
    icon: faGoogle,
    iconComponent: VertexAIIcon,
    colorClass: 'bg-gradient-to-br from-blue-500 to-blue-600',
    modelFilter: 'vertexai',
    panel: ClaudeVertexPanel,
    providerSelector: 'kaiden.vertex-ai:vertex-ai',
    runtimes: ['podman', 'openshell'],
  },
  {
    cliName: 'openclaw',
    title: 'OpenClaw',
    description: 'Open-source autonomous AI agent — local models via Ollama or Ramalama, or cloud APIs.',
    icon: faDesktop,
    iconComponent: OpenClawIcon,
    colorClass: 'bg-gradient-to-br from-red-600 to-red-700',
    panel: OpenRuntimePanel,
    modelFilter: '!vertexai',
  },
  {
    cliName: 'goose',
    title: 'Goose',
    description: 'Open-source autonomous coding agent by Block.',
    icon: faWrench,
    iconComponent: GooseIcon,
    colorClass: 'bg-gradient-to-br from-emerald-600 to-emerald-700',
    runtimes: ['podman'],
    modelFilter: '!vertexai',
  },
];

export type ResolvedAgentDefinition = Omit<AgentDefinition, 'cliName'> & { cliName: string };

const agentMap = new Map<string, AgentDefinition>(agentDefinitions.map(d => [d.cliName, d]));

export function getAgentDefinition(name: string): ResolvedAgentDefinition {
  return agentMap.get(name) ?? { ...DEFAULT_DEFINITION, cliName: name, title: name };
}

export function matchesModelFilter(filter: string, llmMetadataName: string | undefined): boolean {
  if (filter.startsWith('!')) {
    return llmMetadataName !== filter.slice(1);
  }
  return llmMetadataName === filter;
}
