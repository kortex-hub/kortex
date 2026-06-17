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

export const OPENCODE_CONFIG_PATH = '.config/opencode/opencode.json';

const NATIVE_PROVIDERS = new Set(['anthropic', 'mistral', 'google']);

const NATIVE_PROVIDER_SDKS: Record<string, string> = {
  anthropic: '@ai-sdk/anthropic',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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
    isSupportedRuntime(): boolean {
      return true;
    },
    isSupportedModelType(type): boolean {
      return type.name !== 'vertexai';
    },
    async preWorkspaceStart(context: AgentWorkspaceContext): Promise<void> {
      const configFile = context.configurationFiles.find(f => f.path === OPENCODE_CONFIG_PATH);
      if (!configFile) {
        return;
      }

      const content = await configFile.read();
      let config: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(content);
        config = isRecord(parsed) ? parsed : {};
      } catch {
        config = {};
      }

      const modelName = context.model.model.label;
      const provider = context.model.llmMetadata?.name;
      const endpoint = context.model.endpoint;

      if (provider) {
        config['model'] = `${provider}/${modelName}`;

        if ((!NATIVE_PROVIDERS.has(provider) || provider in NATIVE_PROVIDER_SDKS) && endpoint) {
          const providers = isRecord(config['provider']) ? config['provider'] : {};
          const providerEntry = isRecord(providers[provider]) ? providers[provider] : {};

          providerEntry['name'] = provider;
          providerEntry['npm'] = NATIVE_PROVIDER_SDKS[provider] ?? '@ai-sdk/openai-compatible';
          const existingOptions = isRecord(providerEntry['options']) ? providerEntry['options'] : {};
          providerEntry['options'] = { ...existingOptions, baseURL: endpoint };

          const models = isRecord(providerEntry['models']) ? providerEntry['models'] : {};
          models[modelName] ??= { _launch: true, name: modelName };
          providerEntry['models'] = models;

          providers[provider] = providerEntry;
          config['provider'] = providers;
        }
      } else {
        config['model'] = modelName;
      }

      await configFile.update(JSON.stringify(config, undefined, 2));
    },
  });
  extensionContext.subscriptions.push(disposable);
}

export function deactivate(): void {}
