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

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { experimental_createMCPClient } from 'ai';
import { assert, expect, onTestFinished, test } from 'vitest';

import { NPMSpawner } from './npm-spawner';

const DUMMY_FILENAME = 'hello.txt';
const DUMMY_CONTENT = 'Hello World';

test('enabled', async () => {
  const spawner = new NPMSpawner({
    registryType: 'npm',
    identifier: 'dummy',
    version: 'fake',
    runtimeArguments: [],
    packageArguments: [],
  });
  const enabled = await spawner.enabled();
  expect(enabled).toBeTruthy();
});

test(
  'integration',
  async () => {
    const tmp = await mkdtemp('npm-spawner');

    // handle cleanup
    onTestFinished(async () => {
      await rm(tmp, { recursive: true });
    });

    const dummyFile = join(tmp, DUMMY_FILENAME);
    await writeFile(dummyFile, DUMMY_CONTENT);

    const npmSpawner = new NPMSpawner({
      registryType: 'npm',
      identifier: '@modelcontextprotocol/server-filesystem',
      version: '2025.8.21',
      runtimeArguments: [
        {
          name: '--yes',
          type: 'named',
          format: 'boolean',
          default: 'true',
          isRequired: true,
          isSecret: false,
        },
      ],
      packageArguments: [
        {
          isRequired: true,
          default: tmp,
          isSecret: false,
          format: 'filepath',
        },
      ],
    });
    const transport = await npmSpawner.spawn();

    const client = await experimental_createMCPClient({ transport: transport });
    const tools = await client.tools();
    assert('read_text_file' in tools, 'tools should contain read_text_file method');

    const res = await tools['read_text_file'].execute(
      {
        path: dummyFile,
      },
      {
        messages: [],
        toolCallId: '06',
      },
    );
    assert('content' in res);
    assert(Array.isArray(res.content));

    console.log(res);
    expect(res.content).toHaveLength(1);
    expect(res.content[0].isError).toBeFalsy();
    expect(res.content[0].text).toBe(DUMMY_CONTENT);
  },
  {
    skip: true, // do not run
  },
);
