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

import type { AgentWorkspaceContext, ExtensionContext, ModelType } from '@openkaiden/api';
import { agents } from '@openkaiden/api';
import { z } from 'zod';

const OpenClawAgentsSchema = z
  .looseObject({
    defaults: z
      .looseObject({
        model: z.string().optional(),
      })
      .catch({})
      .optional(),
  })
  .catch({});

const McpServerEntrySchema = z.looseObject({
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  transport: z.string().optional(),
  url: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

type McpServerEntry = z.infer<typeof McpServerEntrySchema>;

const McpConfigSchema = z.looseObject({
  servers: z.record(z.string(), McpServerEntrySchema).optional(),
});

const OpenClawConfigSchema = z.looseObject({
  agents: OpenClawAgentsSchema.optional(),
  mcp: McpConfigSchema.optional(),
});

const OpenClawConfigCodec = z.codec(z.string(), OpenClawConfigSchema, {
  decode: (jsonString, ctx) => {
    try {
      return JSON.parse(jsonString);
    } catch (err: unknown) {
      ctx.issues.push({
        code: 'invalid_format',
        format: 'json',
        input: jsonString,
        message: String(err),
      });
      return z.NEVER;
    }
  },
  encode: value => JSON.stringify(value, undefined, 2),
});

function nonEmpty(obj: Record<string, string> | undefined): Record<string, string> | undefined {
  return obj && Object.keys(obj).length > 0 ? obj : undefined;
}

export const OPENCLAW_CONFIG_PATH = '.openclaw/openclaw.json';

export async function activate(extensionContext: ExtensionContext): Promise<void> {
  const disposable = agents.registerAgent({
    id: 'openclaw',
    name: 'OpenClaw',
    description: 'Open-source autonomous AI agent — local models via Ollama or Ramalama, or cloud APIs.',
    icon: {
      icon: './icon.png',
      logo: './icon.png',
    },
    tags: ['Local'],
    command: 'openclaw',
    acp: { args: ['acp'] },
    configurationFiles: [
      {
        path: OPENCLAW_CONFIG_PATH,
        async read(): Promise<string> {
          return '{}';
        },
      },
    ],
    destinationSkillsFolder: '${HOME}/.openclaw/skills',
    isSupportedModelType(type: ModelType): boolean {
      return type.name !== 'vertexai';
    },
    async preWorkspaceStart(context: AgentWorkspaceContext): Promise<void> {
      const configFile = context.configurationFiles.find(f => f.path === OPENCLAW_CONFIG_PATH);
      if (!configFile) {
        return;
      }

      const config = OpenClawConfigCodec.decode(await configFile.read());

      config.agents ??= {};
      config.agents.defaults = { ...config.agents.defaults, model: context.model.model.label };

      const mcpServers = context.workspace.mcp?.servers;
      const mcpCommands = context.workspace.mcp?.commands;

      if (mcpServers?.length || mcpCommands?.length) {
        const servers: Record<string, McpServerEntry> = { ...config.mcp?.servers };

        for (const server of mcpServers ?? []) {
          servers[server.name] = {
            transport: 'streamable-http',
            url: server.url,
            headers: nonEmpty(server.headers),
          };
        }

        for (const cmd of mcpCommands ?? []) {
          servers[cmd.name] = {
            command: cmd.command,
            args: cmd.args ?? [],
            env: nonEmpty(cmd.env),
          };
        }

        config.mcp ??= {};
        config.mcp.servers = servers;
      }

      await configFile.update(OpenClawConfigCodec.encode(config));
    },
  });
  extensionContext.subscriptions.push(disposable);
}

export function deactivate(): void {}
