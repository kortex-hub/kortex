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
import { env } from '@kortex-app/api';
import type { BindToFluentSyntax, ContainerModuleLoadOptions } from 'inversify';
import { beforeEach, expect, test, vi } from 'vitest';

import { socketFinderModule } from '/@/helper/socket-finder/_socket-finder-module';
import { PodmanSocketMacOSFinder } from '/@/helper/socket-finder/podman/podman-macos-finder';
import { PodmanSocketWindowsFinder } from '/@/helper/socket-finder/podman/podman-windows-finder';

vi.mock(import('@kortex-app/api'));

const bindMock = {
  toSelf: vi.fn(),
  inSingletonScope: vi.fn(),
  toService: vi.fn(),
} as unknown as BindToFluentSyntax<unknown>;

const options = {
  bind: vi.fn(),
} as unknown as ContainerModuleLoadOptions;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(options.bind).mockReturnValue(bindMock);
  vi.mocked(bindMock).toSelf.mockReturnThis();
  vi.mocked(bindMock).toService.mockReturnThis();
});

test('test bindings on Windows', async () => {
  vi.mocked(env).isWindows = true;
  vi.mocked(env).isMac = false;
  await socketFinderModule.load(options);

  expect(options.bind).toHaveBeenCalledWith(PodmanSocketWindowsFinder);
});

test('test bindings on macOS', async () => {
  vi.mocked(env).isWindows = false;
  vi.mocked(env).isMac = true;
  await socketFinderModule.load(options);

  expect(options.bind).toHaveBeenCalledWith(PodmanSocketMacOSFinder);
});
