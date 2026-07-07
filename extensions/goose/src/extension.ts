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

import type { AgentWorkspaceContext, ExtensionContext, ModelType } from '@openkaiden/api';
import { agents } from '@openkaiden/api';
import { dump, load } from 'js-yaml';
import { z } from 'zod';

export const GOOSE_CONFIG_PATH = '.config/goose/config.yaml';

const GOOSE_PROVIDER_MAPPING: Record<string, string> = {
  gemini: 'google',
};

const GooseExtensionEntrySchema = z.looseObject({
  name: z.string(),
  type: z.string(),
  enabled: z.boolean(),
  cmd: z.string().optional(),
  args: z.array(z.string()).optional(),
  envs: z.record(z.string(), z.string()).optional(),
  url: z.string().optional(),
  timeout: z.number().optional(),
});

type GooseExtensionEntry = z.infer<typeof GooseExtensionEntrySchema>;

const GooseConfigSchema = z.looseObject({
  extensions: z.record(z.string(), GooseExtensionEntrySchema).optional(),
});

const GooseConfigCodec = z.codec(z.string(), GooseConfigSchema, {
  decode: (yamlString, ctx) => {
    if (!yamlString.trim()) {
      return {};
    }
    try {
      return (load(yamlString) as Record<string, unknown>) ?? {};
    } catch (err: unknown) {
      ctx.issues.push({
        code: 'invalid_format',
        format: 'yaml',
        input: yamlString,
        message: err instanceof Error ? err.message : 'Invalid YAML',
      });
      return z.NEVER;
    }
  },
  encode: value => dump(value),
});

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
    isSupportedRuntime(runtime): boolean {
      return runtime === 'podman';
    },
    isSupportedModelType(type: ModelType): boolean {
      // Vertex AI setup is prepared below, but it is disabled until Kaiden injects it for Goose as Anthropic.
      return type.name !== 'vertexai';
    },
    async preWorkspaceStart(context: AgentWorkspaceContext): Promise<void> {
      const provider = context.model.llmMetadata?.name;

      // Vertex AI + Goose: route through the openshell inference proxy as an
      // Anthropic endpoint. We set GOOSE_PROVIDER=anthropic and ANTHROPIC_HOST
      // here, but openshell overrides GOOSE_PROVIDER with gcp_vertex_ai because
      // Kaiden creates a google-vertex-ai provider secret. Openshell injects
      // its own env vars for that provider type and they win over --env flags.
      // Workaround: pass `--provider anthropic` on the goose CLI to override
      // the openshell-injected GOOSE_PROVIDER at runtime.
      if (provider === 'vertexai') {
        const envVars = [
          { name: 'GOOSE_PROVIDER', value: 'anthropic' },
          { name: 'ANTHROPIC_HOST', value: 'https://inference.local' },
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

      const configFile = context.configurationFiles.find(f => f.path === GOOSE_CONFIG_PATH);
      if (!configFile) {
        return;
      }

      const config = GooseConfigCodec.decode(await configFile.read());
      config.GOOSE_MODEL = context.model.model.label;

      if (provider) {
        config.GOOSE_PROVIDER = provider === 'vertexai' ? 'anthropic' : (GOOSE_PROVIDER_MAPPING[provider] ?? provider);
      }

      const endpoint = context.model.endpoint;
      if (endpoint && provider !== 'vertexai') {
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

      await configFile.update(GooseConfigCodec.encode(config));
    },
  });
  extensionContext.subscriptions.push(disposable);
}

export function deactivate(): void {}
