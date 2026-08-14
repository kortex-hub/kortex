#!/usr/bin/env tsx
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

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { downloadE2fsprogs } from '../src/e2fsprogs-download';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = resolve(__dirname, '..', 'assets');
const SUPPORTED_TARGETS = [
  { platform: 'linux', arch: 'x64' },
  { platform: 'linux', arch: 'arm64' },
];

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    all: { type: 'boolean', default: false },
    platform: { type: 'string' },
    arch: { type: 'string' },
  },
  strict: true,
});

let targets: { platform: string; arch: string }[];
if (values.all) {
  targets = SUPPORTED_TARGETS;
} else if (values.platform && values.arch) {
  const requested = { platform: values.platform, arch: values.arch };
  if (!SUPPORTED_TARGETS.some(target => target.platform === requested.platform && target.arch === requested.arch)) {
    console.error(
      `Unsupported target "${requested.platform}-${requested.arch}". Use --all or one of: ${SUPPORTED_TARGETS.map(target => `${target.platform}-${target.arch}`).join(', ')}`,
    );
    process.exit(1);
  }
  targets = [requested];
} else if (values.platform || values.arch) {
  console.error('--platform and --arch must be specified together');
  process.exit(1);
} else {
  targets = SUPPORTED_TARGETS.filter(target => target.platform === process.platform);
}

if (targets.length === 0) {
  console.log(`No supported e2fsprogs target for host platform "${process.platform}", skipping.`);
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8')) as {
  e2fsprogsVersion?: string;
};
const e2fsprogsVersion = pkg.e2fsprogsVersion;
if (!e2fsprogsVersion) {
  console.error('missing "e2fsprogsVersion" in package.json');
  process.exit(1);
}

(async () => {
  for (const { platform, arch } of targets) {
    await downloadE2fsprogs(e2fsprogsVersion, platform, arch, resolve(ASSETS_DIR, `${platform}-${arch}`, 'e2fsprogs'));
  }
})();
