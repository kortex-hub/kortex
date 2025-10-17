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

import * as api from '@kortex-app/api';

export async function activate(extensionContext: api.ExtensionContext): Promise<void> {
  // Create the Docling chunk provider
  const doclingChunkProvider: api.ChunkProvider = {
    name: 'docling',
    async index(doc: api.Uri): Promise<api.Chunk[]> {
      // TODO: Implement actual Docling chunking logic
      // For now, return empty array as placeholder
      return [];
    },
  };

  // Register the chunk provider
  const disposable = api.rag.registerChunkProvider(doclingChunkProvider);

  // Add to subscriptions for proper cleanup
  extensionContext.subscriptions.push(disposable);
}

export function deactivate(): void {
  console.log('stopping docling extension');
}
