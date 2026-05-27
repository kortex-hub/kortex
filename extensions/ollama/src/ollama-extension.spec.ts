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

import type { NetworkInterfaceInfo } from 'node:os';
import { networkInterfaces } from 'node:os';

import type { AgentWorkspaceInfo, ExtensionContext, Provider } from '@openkaiden/api';
import { agentWorkspace, env, provider } from '@openkaiden/api';
import { http, HttpResponse } from 'msw';
import { setupServer, type SetupServerApi } from 'msw/node';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { OllamaExtension } from './ollama-extension';

vi.mock(import('node:os'));
vi.mock(import('@openkaiden/api'));
vi.mock(import('ollama-ai-provider-v2'));

class TestOllamaExtension extends OllamaExtension {
  public async updateModelsAndStatus(provider: Provider): Promise<void> {
    return super.updateModelsAndStatus(provider);
  }

  public async handleWorkspaceTeardown(workspaceId: string, model?: string): Promise<void> {
    return super.handleWorkspaceTeardown(workspaceId, model);
  }
}

describe('OllamaExtension', () => {
  let extensionContext: ExtensionContext;
  let ollamaProvider: Provider;
  let extension: TestOllamaExtension;
  let server: SetupServerApi | undefined = undefined;

  beforeEach(() => {
    ollamaProvider = {
      updateStatus: vi.fn(),
      registerInferenceProviderConnection: vi.fn(),
      dispose: vi.fn(),
    } as unknown as Provider;
    vi.resetAllMocks();
    vi.mocked(networkInterfaces).mockReturnValue({
      eth0: [{ address: '192.168.1.100', family: 'IPv4', internal: false } as NetworkInterfaceInfo],
    });
    vi.mocked(provider.createProvider).mockReturnValue(ollamaProvider);
    extensionContext = { subscriptions: [] } as unknown as ExtensionContext;
    extension = new TestOllamaExtension(extensionContext);
  });

  afterEach(() => {
    server?.close();
  });

  test('should use local IP endpoint on Windows', async () => {
    vi.mocked(env).isWindows = true;
    const handlers = [
      http.get('http://localhost:11434/api/tags', () =>
        HttpResponse.json({ models: [{ name: 'm1' }, { name: 'm2' }] }),
      ),
    ];
    server = setupServer(...handlers);
    server.listen({ onUnhandledRequest: 'error' });
    await extension.activate();
    expect(vi.mocked(provider.createProvider)).toHaveBeenCalled();
    expect(extensionContext.subscriptions).toContain(ollamaProvider);
    expect(vi.mocked(ollamaProvider.registerInferenceProviderConnection)).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'http://192.168.1.100:11434/v1' }),
    );
    expect(vi.mocked(ollamaProvider.updateStatus)).toHaveBeenCalledWith('started');
  });

  test('should use localhost endpoint on macOS/Linux', async () => {
    vi.mocked(env).isWindows = false;
    const handlers = [
      http.get('http://localhost:11434/api/tags', () =>
        HttpResponse.json({ models: [{ name: 'm1' }, { name: 'm2' }] }),
      ),
    ];
    server = setupServer(...handlers);
    server.listen({ onUnhandledRequest: 'error' });
    await extension.activate();
    expect(vi.mocked(ollamaProvider.registerInferenceProviderConnection)).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'http://localhost:11434/v1' }),
    );
  });

  test('should set status to stopped if fetch fails', async () => {
    // throw error on fetch
    // Simulate network error by throwing
    const handlers = [
      http.get('http://localhost:11434/api/tags', () => {
        throw new Error('fail');
      }),
    ];
    server = setupServer(...handlers);
    server.listen({ onUnhandledRequest: 'error' });
    await extension.activate();
    expect(vi.mocked(ollamaProvider.updateStatus)).toHaveBeenCalledWith('stopped');
    expect(vi.mocked(ollamaProvider.registerInferenceProviderConnection)).not.toHaveBeenCalled();
  });

  test('should unregister and register new connection if models change', async () => {
    const models = [{ name: 'm1' }];
    const handlers = [
      http.get('http://localhost:11434/api/tags', () => {
        return HttpResponse.json({ models });
      }),
    ];
    server = setupServer(...handlers);
    server.listen();
    await extension.activate();
    expect(ollamaProvider.registerInferenceProviderConnection).toHaveBeenCalledTimes(1);
    // Simulate timer, by calling updateModelsAndStatus directly another time with different models
    models.push({ name: 'm2' });
    await extension.updateModelsAndStatus(ollamaProvider);
    expect(ollamaProvider.registerInferenceProviderConnection).toHaveBeenCalledTimes(2);
  });

  test('registers workspace lifecycle listeners on activate', async () => {
    const handlers = [http.get('http://localhost:11434/api/tags', () => HttpResponse.json({ models: [] }))];
    server = setupServer(...handlers);
    server.listen({ onUnhandledRequest: 'error' });

    await extension.activate();

    expect(agentWorkspace.onDidStopWorkspace).toHaveBeenCalled();
    expect(agentWorkspace.onDidRemoveWorkspace).toHaveBeenCalled();
  });
});

describe('handleWorkspaceTeardown', () => {
  let extension: TestOllamaExtension;

  beforeEach(() => {
    vi.resetAllMocks();
    const extensionContext = { subscriptions: [] } as unknown as ExtensionContext;
    extension = new TestOllamaExtension(extensionContext);
  });

  test('unloads Ollama model when stopping the only workspace using it', async () => {
    const workspaces: AgentWorkspaceInfo[] = [
      { id: 'ws-ollama', model: 'ollama::llama3::http://host.containers.internal:11434', state: 'running' },
    ];
    vi.mocked(agentWorkspace.list).mockResolvedValue(workspaces);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: { cancel: vi.fn().mockResolvedValue(undefined) },
    } as unknown as Response);

    await extension.handleWorkspaceTeardown('ws-ollama', 'ollama::llama3::http://host.containers.internal:11434');

    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3', keep_alive: 0 }),
    });
    fetchSpy.mockRestore();
  });

  test('does not unload when another workspace uses the same model', async () => {
    const workspaces: AgentWorkspaceInfo[] = [
      { id: 'ws-1', model: 'ollama::llama3::http://host.containers.internal:11434', state: 'running' },
      { id: 'ws-2', model: 'ollama::llama3::http://host.containers.internal:11434', state: 'running' },
    ];
    vi.mocked(agentWorkspace.list).mockResolvedValue(workspaces);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await extension.handleWorkspaceTeardown('ws-1', 'ollama::llama3::http://host.containers.internal:11434');

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test('does not unload for non-Ollama models', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await extension.handleWorkspaceTeardown('ws-1', 'openai::gpt-4::https://api.openai.com');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(agentWorkspace.list).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test('does not unload when model is undefined', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await extension.handleWorkspaceTeardown('ws-1');

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test('uses default port when endpoint has no explicit port', async () => {
    const workspaces: AgentWorkspaceInfo[] = [
      { id: 'ws-ollama', model: 'ollama::llama3::http://host.containers.internal', state: 'running' },
    ];
    vi.mocked(agentWorkspace.list).mockResolvedValue(workspaces);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: { cancel: vi.fn().mockResolvedValue(undefined) },
    } as unknown as Response);

    await extension.handleWorkspaceTeardown('ws-ollama', 'ollama::llama3::http://host.containers.internal');

    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:11434/api/generate', expect.any(Object));
    fetchSpy.mockRestore();
  });

  test('handles unload failure gracefully', async () => {
    const workspaces: AgentWorkspaceInfo[] = [
      { id: 'ws-ollama', model: 'ollama::llama3::http://host.containers.internal:11434', state: 'running' },
    ];
    vi.mocked(agentWorkspace.list).mockResolvedValue(workspaces);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await extension.handleWorkspaceTeardown('ws-ollama', 'ollama::llama3::http://host.containers.internal:11434');

    expect(warnSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
