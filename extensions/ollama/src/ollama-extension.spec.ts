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

import type { ExtensionContext, Provider } from '@openkaiden/api';
import { env, provider } from '@openkaiden/api';
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
});
