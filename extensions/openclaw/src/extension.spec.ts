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

import type { AgentConfigurationFile, AgentWorkspaceContext, Disposable, ExtensionContext } from '@openkaiden/api';
import { agents } from '@openkaiden/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { activate, OPENCLAW_CONFIG_PATH } from './extension';

vi.mock(import('@openkaiden/api'));

const AGENT_DISPOSABLE_MOCK: Disposable = { dispose: vi.fn() };

let extensionContextMock: ExtensionContext;

beforeEach(() => {
  vi.resetAllMocks();

  extensionContextMock = {
    subscriptions: [],
  } as unknown as ExtensionContext;

  vi.mocked(agents.registerAgent).mockReturnValue(AGENT_DISPOSABLE_MOCK);
});

describe('activate', () => {
  test('registers openclaw agent', async () => {
    await activate(extensionContextMock);

    expect(agents.registerAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'openclaw',
        name: 'OpenClaw',
        description: expect.any(String),
        icon: expect.objectContaining({ icon: './icon.png' }),
        destinationSkillsFolder: '${HOME}/.openclaw/skills',
        isSupportedModelType: expect.any(Function),
      }),
    );
  });

  test('pushes agent disposable to subscriptions', async () => {
    await activate(extensionContextMock);

    expect(extensionContextMock.subscriptions).toContain(AGENT_DISPOSABLE_MOCK);
  });

  test('registered agent supports all model types except vertexai', async () => {
    await activate(extensionContextMock);

    const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];
    expect(agent.isSupportedModelType!({ name: 'openai' })).toBeTruthy();
    expect(agent.isSupportedModelType!({ name: 'gemini' })).toBeTruthy();
    expect(agent.isSupportedModelType!({ name: 'vertexai' })).toBeFalsy();
  });

  test('registers agent with openclaw.json configuration file', async () => {
    await activate(extensionContextMock);

    const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];
    expect(agent.configurationFiles).toHaveLength(1);
    expect(agent.configurationFiles[0]!.path).toBe(OPENCLAW_CONFIG_PATH);
  });

  describe('preWorkspaceStart', () => {
    let agent: ReturnType<typeof vi.mocked<typeof agents.registerAgent>>['mock']['calls'][0][0];

    beforeEach(async () => {
      await activate(extensionContextMock);
      agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];
    });

    function createContext(
      configFiles: AgentConfigurationFile[],
      options: {
        modelLabel?: string;
        mcp?: {
          servers?: { name: string; url: string; headers?: Record<string, string> }[];
          commands?: { name: string; command: string; args?: string[]; env?: Record<string, string> }[];
        };
      } = {},
    ): AgentWorkspaceContext {
      const { modelLabel = 'anthropic/claude-opus-4-6', mcp } = options;
      return {
        model: {
          model: { label: modelLabel },
        },
        configurationFiles: configFiles,
        workspace: { mcp },
      };
    }

    function createConfigFile(content = '{}'): AgentConfigurationFile & { updateMock: ReturnType<typeof vi.fn> } {
      const updateMock = vi.fn();
      return {
        path: OPENCLAW_CONFIG_PATH,
        read: vi.fn().mockResolvedValue(content),
        update: updateMock,
        updateMock,
      };
    }

    function writtenConfig(configFile: { updateMock: ReturnType<typeof vi.fn> }): Record<string, unknown> {
      return JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
    }

    test('writes model configuration into openclaw.json', async () => {
      const configFile = createConfigFile();
      await agent.preWorkspaceStart(createContext([configFile]));

      expect(configFile.updateMock).toHaveBeenCalledOnce();
      const written = writtenConfig(configFile);
      expect(written).toEqual({
        agents: { defaults: { model: 'anthropic/claude-opus-4-6' } },
      });
    });

    test('preserves existing configuration fields', async () => {
      const existingConfig = JSON.stringify({
        agents: { defaults: { model: 'old-model', params: { cacheRetention: 'long' } } },
        other: true,
      });
      const configFile = createConfigFile(existingConfig);
      await agent.preWorkspaceStart(createContext([configFile], { modelLabel: 'openai/gpt-5.5' }));

      const written = writtenConfig(configFile);
      expect(written.agents.defaults.model).toBe('openai/gpt-5.5');
      expect(written.agents.defaults.params.cacheRetention).toBe('long');
      expect(written.other).toBe(true);
    });

    test('throws on invalid JSON', async () => {
      const configFile = createConfigFile('not valid json');
      await expect(agent.preWorkspaceStart(createContext([configFile]))).rejects.toThrow();
    });

    test('throws on non-object JSON', async () => {
      for (const nonObject of ['null', '"string"', '123', '[]']) {
        const configFile = createConfigFile(nonObject);
        await expect(agent.preWorkspaceStart(createContext([configFile]))).rejects.toThrow();
      }
    });

    test('does nothing when config file is not in context', async () => {
      const updateMock = vi.fn();
      const otherFile: AgentConfigurationFile = {
        path: 'some/other/path.json',
        read: vi.fn(),
        update: updateMock,
      };

      await agent.preWorkspaceStart(createContext([otherFile]));

      expect(updateMock).not.toHaveBeenCalled();
    });

    test('writes remote MCP servers from workspace config', async () => {
      const configFile = createConfigFile();
      await agent.preWorkspaceStart(
        createContext([configFile], {
          mcp: {
            servers: [{ name: 'my-remote', url: 'https://mcp.example.com' }],
          },
        }),
      );

      const written = writtenConfig(configFile);
      expect(written.mcp.servers).toEqual({
        'my-remote': { transport: 'streamable-http', url: 'https://mcp.example.com' },
      });
    });

    test('writes remote MCP servers with headers', async () => {
      const configFile = createConfigFile();
      await agent.preWorkspaceStart(
        createContext([configFile], {
          mcp: {
            servers: [
              {
                name: 'authed-server',
                url: 'https://mcp.example.com',
                headers: { Authorization: 'Bearer token123' },
              },
            ],
          },
        }),
      );

      const written = writtenConfig(configFile);
      expect(written.mcp.servers).toEqual({
        'authed-server': {
          transport: 'streamable-http',
          url: 'https://mcp.example.com',
          headers: { Authorization: 'Bearer token123' },
        },
      });
    });

    test('writes local MCP commands from workspace config', async () => {
      const configFile = createConfigFile();
      await agent.preWorkspaceStart(
        createContext([configFile], {
          mcp: {
            commands: [{ name: 'my-local', command: 'npx', args: ['-y', 'my-mcp-server'] }],
          },
        }),
      );

      const written = writtenConfig(configFile);
      expect(written.mcp.servers).toEqual({
        'my-local': { command: 'npx', args: ['-y', 'my-mcp-server'] },
      });
    });

    test('writes local MCP commands with env variables', async () => {
      const configFile = createConfigFile();
      await agent.preWorkspaceStart(
        createContext([configFile], {
          mcp: {
            commands: [
              {
                name: 'github-mcp',
                command: 'npx',
                args: ['@modelcontextprotocol/server-github'],
                env: { GITHUB_TOKEN: 'ghp_test123' },
              },
            ],
          },
        }),
      );

      const written = writtenConfig(configFile);
      expect(written.mcp.servers).toEqual({
        'github-mcp': {
          command: 'npx',
          args: ['@modelcontextprotocol/server-github'],
          env: { GITHUB_TOKEN: 'ghp_test123' },
        },
      });
    });

    test('writes both remote and local MCP servers together', async () => {
      const configFile = createConfigFile();
      await agent.preWorkspaceStart(
        createContext([configFile], {
          mcp: {
            servers: [{ name: 'remote-one', url: 'https://mcp.example.com' }],
            commands: [{ name: 'local-one', command: 'npx', args: ['my-server'] }],
          },
        }),
      );

      const written = writtenConfig(configFile);
      expect(written.mcp.servers).toEqual({
        'remote-one': { transport: 'streamable-http', url: 'https://mcp.example.com' },
        'local-one': { command: 'npx', args: ['my-server'] },
      });
    });

    test('merges MCP servers with existing mcp.servers config', async () => {
      const existingConfig = JSON.stringify({
        mcp: { servers: { 'existing-server': { transport: 'streamable-http', url: 'https://existing.example.com' } } },
      });
      const configFile = createConfigFile(existingConfig);
      await agent.preWorkspaceStart(
        createContext([configFile], {
          mcp: {
            servers: [{ name: 'new-server', url: 'https://new.example.com' }],
          },
        }),
      );

      const written = writtenConfig(configFile);
      expect(written.mcp.servers).toEqual({
        'existing-server': { transport: 'streamable-http', url: 'https://existing.example.com' },
        'new-server': { transport: 'streamable-http', url: 'https://new.example.com' },
      });
    });

    test('does not write mcp key when workspace has no MCP config', async () => {
      const configFile = createConfigFile();
      await agent.preWorkspaceStart(createContext([configFile]));

      const written = writtenConfig(configFile);
      expect(written.mcp).toBeUndefined();
    });

    test('preserves existing mcp.servers when workspace has no MCP config', async () => {
      const existingConfig = JSON.stringify({
        mcp: { servers: { 'existing-server': { command: 'my-server', args: [] } } },
      });
      const configFile = createConfigFile(existingConfig);
      await agent.preWorkspaceStart(createContext([configFile]));

      const written = writtenConfig(configFile);
      expect(written.mcp.servers).toEqual({
        'existing-server': { command: 'my-server', args: [] },
      });
    });

    test('omits headers when remote MCP server has empty headers', async () => {
      const configFile = createConfigFile();
      await agent.preWorkspaceStart(
        createContext([configFile], {
          mcp: {
            servers: [{ name: 'no-headers', url: 'https://mcp.example.com', headers: {} }],
          },
        }),
      );

      const written = writtenConfig(configFile);
      expect(written.mcp.servers['no-headers']).toEqual({
        transport: 'streamable-http',
        url: 'https://mcp.example.com',
      });
    });

    test('omits env when local MCP command has empty env', async () => {
      const configFile = createConfigFile();
      await agent.preWorkspaceStart(
        createContext([configFile], {
          mcp: {
            commands: [{ name: 'minimal', command: 'my-server', args: [], env: {} }],
          },
        }),
      );

      const written = writtenConfig(configFile);
      expect(written.mcp.servers['minimal']).toEqual({ command: 'my-server', args: [] });
    });
  });
});
