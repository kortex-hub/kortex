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

/**
 * Copies Svelte best-practices skills shipped with @sveltejs/opencode
 * into the local .agents/skills/ directory so that AI code assistants
 * can discover them at development time.
 *
 * This script is invoked from the postinstall hook in package.json and
 * is cross-platform (no shell-specific commands).
 */

import { cp } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const source = resolve(__dirname, '..', 'node_modules', '@sveltejs', 'opencode', 'skills');
const destination = resolve(__dirname, '..', '.agents', 'skills');

if (!existsSync(source)) {
  console.log('Skipping svelte skills copy: @sveltejs/opencode not installed.');
  process.exit(0);
}

await cp(source, destination, { recursive: true });
console.log('Copied svelte skills to .agents/skills/');
