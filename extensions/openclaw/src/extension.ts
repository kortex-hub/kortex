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

import type { ExtensionContext, ModelType } from '@openkaiden/api';
import { agents } from '@openkaiden/api';

export async function activate(extensionContext: ExtensionContext): Promise<void> {
  const disposable = agents.registerAgent({
    id: 'openclaw',
    name: 'OpenClaw',
    description: 'Open-source autonomous AI agent — local models via Ollama or Ramalama, or cloud APIs.',
    icon: {
      icon: './icon.png',
      logo: './icon.png',
    },
    command: 'openclaw',
    acp: { args: ['acp'] },
    configurationFiles: [],
    destinationSkillsFolder: '${HOME}/.openclaw/skills',
    isSupportedModelType(type: ModelType): boolean {
      return type.name !== 'vertexai';
    },
    async preWorkspaceStart(): Promise<void> {
      throw new Error('not implemented');
    },
  });
  extensionContext.subscriptions.push(disposable);
}

export function deactivate(): void {}
