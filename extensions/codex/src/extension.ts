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

import type { ExtensionContext } from '@openkaiden/api';
import { agents } from '@openkaiden/api';

export async function activate(extensionContext: ExtensionContext): Promise<void> {
  const disposable = agents.registerAgent({
    id: 'codex',
    name: 'Codex',
    description: 'OpenAI Codex — a cloud-based coding agent that runs in a sandboxed environment with OpenAI models.',
    icon: {
      icon: './icon.png',
      logo: { dark: './icon.png', light: './icon.png' },
    },
    isSupportedModelType(type): boolean {
      return type.name === 'openai';
    },
  });
  extensionContext.subscriptions.push(disposable);
}

export function deactivate(): void {}
