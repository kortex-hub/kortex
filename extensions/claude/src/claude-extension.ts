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

import type { Disposable, ExtensionContext } from '@openkaiden/api';
import { agents, provider } from '@openkaiden/api';
import type { Container } from 'inversify';

import { InversifyBinding } from '/@/inject/inversify-binding';
import { ClaudeInferenceManager } from '/@/manager/claude-inference-manager';
import { ClaudeSkillsManager } from '/@/manager/claude-skills-manager';

export class ClaudeExtension {
  #extensionContext: ExtensionContext;

  #inversifyBinding: InversifyBinding | undefined;
  #container: Container | undefined;
  #claudeSkillsManager: ClaudeSkillsManager | undefined;
  #claudeInferenceManager: ClaudeInferenceManager | undefined;
  #agentDisposable: Disposable | undefined;

  constructor(extensionContext: ExtensionContext) {
    this.#extensionContext = extensionContext;
  }

  async activate(): Promise<void> {
    const providerImages = {
      icon: './icon.png',
      logo: {
        dark: './icon.png',
        light: './icon.png',
      },
    };

    const claudeProvider = provider.createProvider({
      name: 'Claude',
      status: 'unknown',
      id: 'claude',
      images: providerImages,
    });

    this.#agentDisposable = agents.registerAgent({
      id: 'claude',
      name: 'Claude Code',
      description: 'Anthropic cloud agent — connect with an API key to access Claude models.',
      icon: providerImages,
      command: 'claude',
      tags: ['Cloud'],
      isSupportedModelType: (type): boolean => type.name === 'anthropic',
    });

    this.#inversifyBinding = new InversifyBinding(claudeProvider, this.#extensionContext);
    this.#container = await this.#inversifyBinding.initBindings();

    try {
      this.#claudeSkillsManager = await this.getContainer()?.getAsync(ClaudeSkillsManager);
    } catch (e) {
      console.error('Error while creating the Claude skills manager', e);
      throw e;
    }

    try {
      this.#claudeInferenceManager = await this.getContainer()?.getAsync(ClaudeInferenceManager);
    } catch (e) {
      console.error('Error while creating the Claude inference manager', e);
      throw e;
    }

    await this.#claudeSkillsManager?.init();
    await this.#claudeInferenceManager?.init();
  }

  protected getContainer(): Container | undefined {
    return this.#container;
  }

  async deactivate(): Promise<void> {
    this.#agentDisposable?.dispose();
    this.#agentDisposable = undefined;
    await this.#inversifyBinding?.dispose();
    this.#claudeSkillsManager?.dispose();
    this.#claudeSkillsManager = undefined;
    this.#claudeInferenceManager?.dispose();
    this.#claudeInferenceManager = undefined;
  }
}
