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

import { activate, OPENCODE_CONFIG_PATH } from './extension';

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
  test('registers opencode agent', async () => {
    await activate(extensionContextMock);

    expect(agents.registerAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'opencode',
        name: 'OpenCode',
        description: expect.any(String),
        icon: expect.objectContaining({ icon: { dark: './icon_dark.png', light: './icon_light.png' } }),
        tags: ['Recommended'],
        isSupportedModelType: expect.any(Function),
        isSupportedRuntime: expect.any(Function),
      }),
    );
  });

  test('pushes agent disposable to subscriptions', async () => {
    await activate(extensionContextMock);

    expect(extensionContextMock.subscriptions).toContain(AGENT_DISPOSABLE_MOCK);
  });

  test('registered agent supports all runtimes', async () => {
    await activate(extensionContextMock);

    const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];
    expect(agent.isSupportedRuntime!('podman')).toBe(true);
    expect(agent.isSupportedRuntime!('openshell')).toBe(true);
  });

  test('registered agent supports all model types except vertexai', async () => {
    await activate(extensionContextMock);

    const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];
    expect(agent.isSupportedModelType!({ name: 'openai' })).toBe(true);
    expect(agent.isSupportedModelType!({ name: 'gemini' })).toBe(true);
    expect(agent.isSupportedModelType!({ name: 'vertexai' })).toBe(false);
  });

  test('registers agent with opencode.json configuration file', async () => {
    await activate(extensionContextMock);

    const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];
    expect(agent.configurationFiles).toHaveLength(1);
    expect(agent.configurationFiles[0]!.path).toBe(OPENCODE_CONFIG_PATH);
  });

  describe('preWorkspaceStart', () => {
    function createContext(
      configFiles: AgentConfigurationFile[],
      options: { modelLabel?: string; provider?: string; endpoint?: string } = {},
    ): AgentWorkspaceContext {
      const { modelLabel = 'gpt-4o', provider, endpoint } = options;
      return {
        model: {
          model: { label: modelLabel },
          llmMetadata: provider ? { name: provider } : undefined,
          endpoint,
        },
        configurationFiles: configFiles,
        workspace: {},
      };
    }

    function createConfigFile(content = '{}'): AgentConfigurationFile & { updateMock: ReturnType<typeof vi.fn> } {
      const updateMock = vi.fn();
      const file: AgentConfigurationFile = {
        path: OPENCODE_CONFIG_PATH,
        read: vi.fn().mockResolvedValue(content),
        update: updateMock,
      };
      return Object.assign(file, { updateMock });
    }

    test('writes model name when no provider is specified', async () => {
      await activate(extensionContextMock);
      const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];

      const configFile = createConfigFile();
      await agent.preWorkspaceStart(createContext([configFile]));

      expect(configFile.updateMock).toHaveBeenCalledOnce();
      const written = JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
      expect(written).toEqual({ model: 'gpt-4o' });
    });

    test('writes provider/model format when provider is specified', async () => {
      await activate(extensionContextMock);
      const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];

      const configFile = createConfigFile();
      await agent.preWorkspaceStart(
        createContext([configFile], { provider: 'anthropic', modelLabel: 'claude-sonnet' }),
      );

      expect(configFile.updateMock).toHaveBeenCalledOnce();
      const written = JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
      expect(written).toEqual({ model: 'anthropic/claude-sonnet' });
    });

    test('adds provider block for non-native provider with endpoint', async () => {
      await activate(extensionContextMock);
      const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];

      const configFile = createConfigFile();
      await agent.preWorkspaceStart(
        createContext([configFile], {
          provider: 'ollama',
          modelLabel: 'llama3',
          endpoint: 'http://localhost:11434/v1',
        }),
      );

      expect(configFile.updateMock).toHaveBeenCalledOnce();
      const written = JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
      expect(written).toEqual({
        model: 'ollama/llama3',
        provider: {
          ollama: {
            name: 'ollama',
            npm: '@ai-sdk/openai-compatible',
            options: { baseURL: 'http://localhost:11434/v1' },
            models: {
              llama3: { _launch: true, name: 'llama3' },
            },
          },
        },
      });
    });

    test('merges existing provider options instead of overwriting', async () => {
      await activate(extensionContextMock);
      const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];

      const existingConfig = JSON.stringify({
        provider: {
          ollama: {
            options: { apiKey: 'keep-me', baseURL: 'old-url' },
          },
        },
      });
      const configFile = createConfigFile(existingConfig);
      await agent.preWorkspaceStart(
        createContext([configFile], {
          provider: 'ollama',
          modelLabel: 'llama3',
          endpoint: 'http://localhost:11434/v1',
        }),
      );

      const written = JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
      expect(written.provider.ollama.options).toEqual({
        apiKey: 'keep-me',
        baseURL: 'http://localhost:11434/v1',
      });
    });

    test('handles malformed nested provider values gracefully', async () => {
      await activate(extensionContextMock);
      const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];

      const existingConfig = JSON.stringify({
        provider: 'not-an-object',
      });
      const configFile = createConfigFile(existingConfig);
      await agent.preWorkspaceStart(
        createContext([configFile], {
          provider: 'ollama',
          modelLabel: 'llama3',
          endpoint: 'http://localhost:11434/v1',
        }),
      );

      expect(configFile.updateMock).toHaveBeenCalledOnce();
      const written = JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
      expect(written.provider.ollama.name).toBe('ollama');
    });

    test('uses native SDK for anthropic provider with custom endpoint', async () => {
      await activate(extensionContextMock);
      const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];

      const configFile = createConfigFile();
      await agent.preWorkspaceStart(
        createContext([configFile], {
          provider: 'anthropic',
          modelLabel: 'claude-sonnet',
          endpoint: 'https://custom.anthropic.example.com',
        }),
      );

      const written = JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
      expect(written.model).toBe('anthropic/claude-sonnet');
      expect(written.provider.anthropic.npm).toBe('@ai-sdk/anthropic');
      expect(written.provider.anthropic.options.baseURL).toBe('https://custom.anthropic.example.com');
    });

    test('does not add provider block for native provider with endpoint', async () => {
      await activate(extensionContextMock);
      const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];

      const configFile = createConfigFile();
      await agent.preWorkspaceStart(
        createContext([configFile], {
          provider: 'google',
          modelLabel: 'gemini-pro',
          endpoint: 'https://generativelanguage.googleapis.com',
        }),
      );

      const written = JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
      expect(written).toEqual({ model: 'google/gemini-pro' });
    });

    test('preserves existing configuration fields', async () => {
      await activate(extensionContextMock);
      const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];

      const existingConfig = JSON.stringify({ theme: 'dark', version: 3 });
      const configFile = createConfigFile(existingConfig);
      await agent.preWorkspaceStart(createContext([configFile], { modelLabel: 'gpt-4o' }));

      const written = JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
      expect(written.theme).toBe('dark');
      expect(written.version).toBe(3);
      expect(written.model).toBe('gpt-4o');
    });

    test('handles invalid JSON by starting with empty config', async () => {
      await activate(extensionContextMock);
      const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];

      const configFile = createConfigFile('not valid json');
      await agent.preWorkspaceStart(createContext([configFile]));

      expect(configFile.updateMock).toHaveBeenCalledOnce();
      const written = JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
      expect(written.model).toBe('gpt-4o');
    });

    test('normalizes non-object JSON to empty config', async () => {
      await activate(extensionContextMock);
      const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];

      for (const nonObject of ['null', '"string"', '123', '[]']) {
        const configFile = createConfigFile(nonObject);

        await agent.preWorkspaceStart(createContext([configFile]));

        expect(configFile.updateMock).toHaveBeenCalledOnce();
        const written = JSON.parse(configFile.updateMock.mock.calls[0]![0] as string);
        expect(written.model).toBe('gpt-4o');
      }
    });

    test('does nothing when config file is not in context', async () => {
      await activate(extensionContextMock);
      const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];

      const updateMock = vi.fn();
      const otherFile: AgentConfigurationFile = {
        path: 'some/other/path.json',
        read: vi.fn(),
        update: updateMock,
      };

      await agent.preWorkspaceStart(createContext([otherFile]));

      expect(updateMock).not.toHaveBeenCalled();
    });
  });
});
