/**********************************************************************
 * Copyright (C) 2025-2026 Red Hat, Inc.
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
import { dump, load } from 'js-yaml';

export const GOOSE_CONFIG_PATH = '.config/goose/config.yaml';

const GOOSE_PROVIDER_MAPPING: Record<string, string> = {
  gemini: 'google',
  vertexai: 'gcp-vertex',
};

interface GooseExtensionEntry {
  name: string;
  type: string;
  enabled: boolean;
  cmd?: string;
  args?: string[];
  envs?: Record<string, string>;
  url?: string;
  timeout?: number;
}

interface GooseConfig {
  [key: string]: unknown;
  extensions?: Record<string, GooseExtensionEntry>;
}

function parseGooseConfig(content: string): GooseConfig {
  if (!content.trim()) {
    return {};
  }
  return (load(content) as GooseConfig) ?? {};
}

export async function activate(extensionContext: ExtensionContext): Promise<void> {
  const disposable = agents.registerAgent({
    id: 'goose',
    name: 'Goose',
    description: 'Open-source autonomous coding agent by Block.',
    icon: {
      icon: { dark: './icon_dark.png', light: './icon_light.png' },
      logo: { dark: './icon_dark.png', light: './icon_light.png' },
    },
    command: 'goose',
    // TODO: replace with official image once available — temporary testing image
    baseImage: 'quay.io/bmahabir/openkaiden/openshell-goose:latest',
    acp: { args: ['acp'] },
    configurationFiles: [
      {
        path: GOOSE_CONFIG_PATH,
        async read(): Promise<string> {
          return '';
        },
      },
    ],
    destinationSkillsFolder: '${HOME}/.agents/skills',
    isSupportedModelType(): boolean {
      return true;
    },
    async preWorkspaceStart(context: AgentWorkspaceContext): Promise<void> {
      const configFile = context.configurationFiles.find(f => f.path === GOOSE_CONFIG_PATH);
      if (!configFile) {
        return;
      }

      const config = parseGooseConfig(await configFile.read());
      config.GOOSE_MODEL = context.model.model.label;

      const provider = context.model.llmMetadata?.name;
      if (provider) {
        config.GOOSE_PROVIDER = GOOSE_PROVIDER_MAPPING[provider] ?? provider;
      }

      const endpoint = context.model.endpoint;
      if (endpoint) {
        config.OPENAI_BASE_URL = endpoint;
      }

      const mcpServers = context.workspace.mcp?.servers;
      const mcpCommands = context.workspace.mcp?.commands;

      if (mcpServers?.length || mcpCommands?.length) {
        const extensions: Record<string, GooseExtensionEntry> = { ...config.extensions };

        for (const server of mcpServers ?? []) {
          extensions[server.name] = {
            name: server.name,
            type: 'streamable_http',
            url: server.url,
            enabled: true,
            ...(server.headers && Object.keys(server.headers).length > 0 ? { envs: server.headers } : {}),
          };
        }

        for (const cmd of mcpCommands ?? []) {
          extensions[cmd.name] = {
            name: cmd.name,
            type: 'stdio',
            cmd: cmd.command,
            args: cmd.args ?? [],
            enabled: true,
            ...(cmd.env && Object.keys(cmd.env).length > 0 ? { envs: cmd.env } : {}),
          };
        }

        config.extensions = extensions;
      }

      await configFile.update(dump(config));
    },
  });
  extensionContext.subscriptions.push(disposable);
}

export function deactivate(): void {}
