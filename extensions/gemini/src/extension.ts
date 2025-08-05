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

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { ExtensionContext, ProviderConnectionStatus } from '@kortex-app/api';
import { provider } from '@kortex-app/api';

function maskKey(name: string): string {
  if (!name || name.length <= 3) return name;
  return name.slice(0, 3) + '*'.repeat(name.length - 3);
}

export async function activate(extensionContext: ExtensionContext): Promise<void> {
  const gemini = provider.createProvider({
    name: 'Gemini',
    status: 'unknown',
    id: 'gemini',
  });
  gemini.setInferenceProviderConnectionFactory({
    async create(params: { [p: string]: unknown }): Promise<void> {
      console.log('creating gemini connection', params);

      // collect apiKey
      const apiKey = params['gemini.factory.apiKey'];
      if (!apiKey || typeof apiKey !== 'string') throw new Error('invalid apiKey');

      // create ProviderV2
      const google = createGoogleGenerativeAI({
        apiKey: apiKey,
      });

      // TODO: find a way to check connection?
      // TODO: save the token for later re-creation (/!\ use safe storage)

      const connection = gemini.registerInferenceProviderConnection({
        name: maskKey(apiKey),
        sdk: google,
        status(): ProviderConnectionStatus {
          return 'started';
        },
      });
      extensionContext.subscriptions.push(connection);
    },
  });
  extensionContext.subscriptions.push(gemini);

  console.log('starting gemini extension');
}

export function deactivate(): void {
  console.log('stopping gemini extension');
}
