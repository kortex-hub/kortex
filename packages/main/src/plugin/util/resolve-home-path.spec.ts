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

import { homedir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { resolveHomePath } from './resolve-home-path.js';

vi.mock(import('node:os'));

describe('resolveHomePath', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(homedir).mockReturnValue('/home/testuser');
  });

  test('resolves bare ~ to home directory', () => {
    expect(resolveHomePath('~')).toBe('/home/testuser');
  });

  test('resolves ~/path to home directory joined with path', () => {
    expect(resolveHomePath('~/my-project')).toBe(join('/home/testuser', 'my-project'));
  });

  test('resolves ~/nested/path to home directory joined with nested path', () => {
    expect(resolveHomePath('~/a/b/c')).toBe(join('/home/testuser', 'a/b/c'));
  });

  test('returns absolute paths unchanged', () => {
    expect(resolveHomePath('/tmp/my-project')).toBe('/tmp/my-project');
  });

  test('returns relative paths unchanged', () => {
    expect(resolveHomePath('relative/path')).toBe('relative/path');
  });
});
