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

import type * as api from '@kortex-app/api';

import { DoclingExtension } from './docling-extension';

let docling: DoclingExtension | undefined;

export async function activate(extensionContext: api.ExtensionContext): Promise<void> {
  console.log('Starting Docling extension');

  docling = new DoclingExtension(extensionContext);
  docling.activate().catch(console.error);
}

export async function deactivate(): Promise<void> {
  console.log('Stopping Docling extension');

  // Shutdown the Docling chunker
  if (docling) {
    await docling.deactivate();
    docling = undefined;
  }
}
