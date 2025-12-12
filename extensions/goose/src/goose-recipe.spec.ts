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
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Disposable, Provider, provider as ProviderAPI } from '@kortex-app/api';
import { EventEmitter } from '@kortex-app/api';
import { assert, beforeEach, describe, expect, test, vi } from 'vitest';

import type { GooseCLI } from './goose-cli';
import { GooseRecipe } from './goose-recipe';

vi.mock(import('node:fs/promises'));
vi.mock('@kortex-app/api', () => ({
  EventEmitter: vi.fn(),
}));

const PROVIDER_API_MOCK = {
  createProvider: vi.fn(),
} as unknown as typeof ProviderAPI;
const GOOSE_CLI_MOCK = {
  isInstalled: vi.fn(),
  event: vi.fn(),
} as unknown as GooseCLI;

const GOOSE_PROVIDER_MOCK = {
  registerFlowProviderConnection: vi.fn(),
} as unknown as Provider;

const EVENT_EMITTER_MOCK = {
  Event: {},
} as unknown as EventEmitter<unknown>;

const KORTEX_VERSION = '0.1.0';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(PROVIDER_API_MOCK.createProvider).mockReturnValue(GOOSE_PROVIDER_MOCK);
  vi.mocked(EventEmitter).mockReturnValue(EVENT_EMITTER_MOCK);
});

describe('GooseRecipe#init', () => {
  let recipe: GooseRecipe;
  beforeEach(() => {
    recipe = new GooseRecipe(PROVIDER_API_MOCK, GOOSE_CLI_MOCK, KORTEX_VERSION);
  });

  test('constructor should not register any provider', () => {
    expect(PROVIDER_API_MOCK.createProvider).not.toHaveBeenCalled();
  });

  test('constructor should not register cli update listener', () => {
    expect(GOOSE_CLI_MOCK.event).not.toHaveBeenCalled();
  });

  test('init should register provider', () => {
    recipe.init();
    expect(PROVIDER_API_MOCK.createProvider).toHaveBeenCalledOnce();
    expect(PROVIDER_API_MOCK.createProvider).toHaveBeenCalledWith({
      id: 'goose',
      name: 'goose',
      status: 'unknown',
      emptyConnectionMarkdownDescription: expect.any(String),
      images: expect.anything(),
    });
  });

  test('init should register GooseCli#event', () => {
    recipe.init();
    expect(GOOSE_CLI_MOCK.event).toHaveBeenCalledOnce();
    expect(GOOSE_CLI_MOCK.event).toHaveBeenCalledWith(expect.any(Function));
  });
});

describe('cliAPI#onDidChange', () => {
  const DISPOSE_MOCK: Disposable = {
    dispose: vi.fn(),
  };

  let listener: (e: 'uninstall' | 'update') => void;
  beforeEach(() => {
    const recipe = new GooseRecipe(PROVIDER_API_MOCK, GOOSE_CLI_MOCK, KORTEX_VERSION);
    recipe.init();

    const call = vi.mocked(GOOSE_CLI_MOCK.event).mock.calls[0];
    assert(call, 'the on did change should have been called once');

    listener = call[0];

    vi.mocked(GOOSE_PROVIDER_MOCK.registerFlowProviderConnection).mockReturnValue(DISPOSE_MOCK);
  });

  test('expect no flow provider connection by default', () => {
    expect(GOOSE_PROVIDER_MOCK.registerFlowProviderConnection).not.toHaveBeenCalled();
  });

  test('expect flow connection to be registered if goose cli available', () => {
    vi.mocked(GOOSE_CLI_MOCK.isInstalled).mockReturnValue(true);

    listener('update');

    expect(GOOSE_PROVIDER_MOCK.registerFlowProviderConnection).toHaveBeenCalledOnce();
    expect(GOOSE_PROVIDER_MOCK.registerFlowProviderConnection).toHaveBeenCalledWith({
      name: 'goose-recipes',
      flow: {
        // event
        onDidChange: EVENT_EMITTER_MOCK.event,
        // functions
        all: expect.any(Function),
        read: expect.any(Function),
        create: expect.any(Function),
        delete: expect.any(Function),
        execute: expect.any(Function),
        generate: expect.any(Function),
        generateCommandLine: expect.any(Function),
        generateKubernetesYAML: expect.any(Function),
      },
      lifecycle: {},
      status: expect.any(Function),
    });
  });

  test('expect read to support the extended windows path', async () => {
    vi.mocked(GOOSE_CLI_MOCK.isInstalled).mockReturnValue(true);

    listener('update');

    expect(GOOSE_PROVIDER_MOCK.registerFlowProviderConnection).toHaveBeenCalledOnce();
    const readListener = vi.mocked(GOOSE_PROVIDER_MOCK.registerFlowProviderConnection).mock.calls[0]?.[0]?.flow?.read;
    assert(readListener);

    const dummyRecipePath = join(homedir(), '.config', 'goose', 'recipes', 'foo.yaml');
    const extendedPath = `\\\\?\\${dummyRecipePath}`;
    const encoded = Buffer.from(extendedPath).toString('base64');
    await readListener(encoded);

    expect(readFile).toHaveBeenCalledExactlyOnceWith(extendedPath, 'utf-8');
  });

  test('expect flow connection not to be registered if goose cli is not isInstalled', () => {
    vi.mocked(GOOSE_CLI_MOCK.isInstalled).mockReturnValue(false);

    listener('uninstall');

    expect(GOOSE_PROVIDER_MOCK.registerFlowProviderConnection).not.toHaveBeenCalled();
  });

  test('calling twice with goose cli isInstalled should only registered once', () => {
    vi.mocked(GOOSE_CLI_MOCK.isInstalled).mockReturnValue(true);

    listener('update');

    expect(GOOSE_PROVIDER_MOCK.registerFlowProviderConnection).toHaveBeenCalledOnce();

    listener('update');

    expect(GOOSE_PROVIDER_MOCK.registerFlowProviderConnection).toHaveBeenCalledOnce();
  });

  test('uninstall should unregister flow provider connection', () => {
    vi.mocked(GOOSE_CLI_MOCK.isInstalled).mockReturnValue(true);
    listener('update');

    expect(GOOSE_PROVIDER_MOCK.registerFlowProviderConnection).toHaveBeenCalledOnce();
    expect(DISPOSE_MOCK.dispose).not.toHaveBeenCalled();

    vi.mocked(GOOSE_CLI_MOCK.isInstalled).mockReturnValue(false);
    listener('uninstall');

    expect(DISPOSE_MOCK.dispose).toHaveBeenCalledOnce();
  });
});

describe('goose recipe secrets hiding', () => {
  test('should hide secrets in headers', async () => {
    const recipe = new GooseRecipe(PROVIDER_API_MOCK, GOOSE_CLI_MOCK, KORTEX_VERSION);
    const recipeContent = `
    title: test-flow
    extensions:
      - name: github-mcp
        type: streamable_http
        uri: GitHub's official MCP Server
        headers:
          Authorization: "Bearer real-github-token-67890"
    `;

    const result = recipe.hideSecretsInRecipeContent(recipeContent);

    expect(result).toContain('Authorization: "******************************"');
    expect(result).not.toContain('real-github-token-67890');
    expect(result).not.toContain('Bearer');
  });
});
