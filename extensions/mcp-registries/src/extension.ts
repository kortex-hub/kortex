/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at *
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

import * as extensionApi from '@kortex-app/api';

import quayIoImage from './images/quay.io.png';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function activate(extensionContext: extensionApi.ExtensionContext): Promise<void> {
  // For each defaultRegistries, suggest the registry to Podman Desktop
  for (const registry of defaultRegistries) {
    // Suggest it to the registry and add to subscriptions
    const disposable = extensionApi.mcpRegistry.suggestRegistry(registry);
    extensionContext.subscriptions.push(disposable);
  }
}

export function deactivate(): void {
  console.log('stopping registries extension');
}

// Const array of list of approved registries that contain the default URL as well as base64 encoded version of their logo
// The 'registries' will check the local directory for an icon named the same as the registry
const defaultRegistries: extensionApi.RegistrySuggestedProvider[] = [
  {
    name: 'MCP Registry example',
    url: 'https://kortex-hub.github.io/mcp-registry-online-v1.1.0',
    icon: quayIoImage,
  },
];
