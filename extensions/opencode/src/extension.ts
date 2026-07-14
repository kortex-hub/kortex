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

import type { AgentWorkspaceContext, ExtensionContext } from '@openkaiden/api';
import { agents } from '@openkaiden/api';
import { z } from 'zod';

export const OPENCODE_CONFIG_PATH = '.config/opencode/opencode.json';

const ModelEntrySchema = z.object({
  _launch: z.boolean(),
  name: z.string(),
});

const ProviderEntrySchema = z.looseObject({
  name: z.string().optional(),
  npm: z.string().optional(),
  options: z.record(z.string(), z.unknown()).default({}),
  models: z.record(z.string(), ModelEntrySchema).default({}),
});

const McpEntrySchema = z.discriminatedUnion('type', [
  z.looseObject({
    type: z.literal('remote'),
    url: z.string(),
    enabled: z.boolean(),
    headers: z.record(z.string(), z.string()).optional(),
  }),
  z.looseObject({
    type: z.literal('local'),
    command: z.array(z.string()),
    enabled: z.boolean(),
    environment: z.record(z.string(), z.string()).optional(),
  }),
]);

type McpEntry = z.infer<typeof McpEntrySchema>;

const OpenCodeConfigSchema = z.looseObject({
  model: z.string().optional(),
  provider: z.record(z.string(), ProviderEntrySchema).optional(),
  mcp: z.record(z.string(), McpEntrySchema).optional(),
});

const NATIVE_PROVIDERS = new Set(['anthropic', 'mistral', 'google']);

const NATIVE_PROVIDER_SDKS: Record<string, string> = {
  anthropic: '@ai-sdk/anthropic',
};

export async function activate(extensionContext: ExtensionContext): Promise<void> {
  const disposable = agents.registerAgent({
    id: 'opencode',
    name: 'OpenCode',
    description:
      'Open-source agent on your machine — local models via Ollama or Ramalama, or cloud APIs (OpenAI, Gemini, and other providers OpenCode supports).',
    icon: {
      icon: { dark: './icon_dark.png', light: './icon_light.png' },
      logo: { dark: './icon_dark.png', light: './icon_light.png' },
    },
    command: 'opencode',
    acp: { args: ['acp'] },
    tags: ['Recommended'],
    configurationFiles: [
      {
        path: OPENCODE_CONFIG_PATH,
        async read(): Promise<string> {
          return '{}';
        },
      },
    ],
    destinationSkillsFolder: '${HOME}/.opencode/skills',
    isSupportedRuntime(): boolean {
      return true;
    },
    isSupportedModelType(): boolean {
      return true;
    },
    async preWorkspaceStart(context: AgentWorkspaceContext): Promise<void> {
      if (context.model.llmMetadata?.name === 'vertexai') {
        const envVars = [
          { name: 'ANTHROPIC_BASE_URL', value: 'https://inference.local/v1' },
          { name: 'ANTHROPIC_API_KEY', value: 'unused' },
        ];

        context.workspace.environment ??= [];
        for (const envVar of envVars) {
          const index = context.workspace.environment.findIndex(e => e.name === envVar.name);
          if (index >= 0) {
            context.workspace.environment.splice(index, 1);
          }
          context.workspace.environment.push(envVar);
        }
      }

      const configFile = context.configurationFiles.find(f => f.path === OPENCODE_CONFIG_PATH);
      if (!configFile) {
        return;
      }

      const config = OpenCodeConfigSchema.parse(JSON.parse(await configFile.read()));

      const modelName = context.model.model.label;
      const provider = context.model.llmMetadata?.name;
      const endpoint = context.model.endpoint;

      if (provider) {
        config.model = `${provider}/${modelName}`;

        if ((!NATIVE_PROVIDERS.has(provider) || provider in NATIVE_PROVIDER_SDKS) && endpoint) {
          const providers = config.provider ?? {};
          const providerEntry = providers[provider] ?? {};

          providerEntry.name = provider;
          providerEntry.npm = NATIVE_PROVIDER_SDKS[provider] ?? '@ai-sdk/openai-compatible';
          providerEntry.options = { apiKey: '{env:OPENAI_API_KEY}', ...providerEntry.options, baseURL: endpoint };

          providerEntry.models ??= {};
          providerEntry.models[modelName] ??= { _launch: true, name: modelName };

          providers[provider] = providerEntry;
          config.provider = providers;
        }
      } else {
        config.model = modelName;
      }

      const mcpServers = context.workspace.mcp?.servers;
      const mcpCommands = context.workspace.mcp?.commands;

      if (mcpServers?.length || mcpCommands?.length) {
        const mcp: Record<string, McpEntry> = { ...config.mcp };

        for (const server of mcpServers ?? []) {
          mcp[server.name] = {
            type: 'remote',
            url: server.url,
            enabled: true,
            ...(server.headers && Object.keys(server.headers).length > 0 ? { headers: server.headers } : {}),
          };
        }

        for (const cmd of mcpCommands ?? []) {
          mcp[cmd.name] = {
            type: 'local',
            command: [cmd.command, ...(cmd.args ?? [])],
            enabled: true,
            ...(cmd.env && Object.keys(cmd.env).length > 0 ? { environment: cmd.env } : {}),
          };
        }

        config.mcp = mcp;
      }

      await configFile.update(JSON.stringify(config, undefined, 2));
    },
  });
  extensionContext.subscriptions.push(disposable);
}

export function deactivate(): void {}
