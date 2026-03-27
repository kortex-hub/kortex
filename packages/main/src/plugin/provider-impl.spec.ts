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

import type { ProviderOptions } from '@kortex-app/api';
import { beforeEach, expect, test, vi } from 'vitest';

import type { SchedulerRegistry } from '/@/plugin/scheduler/scheduler-registry.js';
import type { SkillManager } from '/@/plugin/skill/skill-manager.js';

import type { ContainerProviderRegistry } from './container-registry.js';
import { ProviderImpl } from './provider-impl.js';
import type { ProviderRegistry } from './provider-registry.js';

let providerImpl: ProviderImpl;
let skillManager: SkillManager;

beforeEach(() => {
  vi.resetAllMocks();

  skillManager = {
    registerSkillFolder: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  } as unknown as SkillManager;

  const providerRegistry = {} as unknown as ProviderRegistry;
  const containerRegistry = {} as unknown as ContainerProviderRegistry;
  const schedulerRegistry = {} as unknown as SchedulerRegistry;

  providerImpl = new ProviderImpl(
    '1',
    'test-extension',
    'Test Extension',
    { name: 'test', status: 'installed' } as unknown as ProviderOptions,
    providerRegistry,
    containerRegistry,
    schedulerRegistry,
    skillManager,
  );
});

test('registerSkill should delegate to skillManager.registerSkillFolder', () => {
  providerImpl.registerSkill({ label: 'my-skills', path: '/ext/skills' });

  expect(skillManager.registerSkillFolder).toHaveBeenCalledWith({
    label: 'my-skills',
    badge: 'Test Extension',
    baseDirectory: '/ext/skills',
  });
});

test('registerSkill should return a disposable that cleans up', () => {
  const innerDispose = vi.fn();
  vi.mocked(skillManager.registerSkillFolder).mockReturnValue({ dispose: innerDispose });

  const disposable = providerImpl.registerSkill({ label: 'my-skills', path: '/ext/skills' });
  disposable.dispose();

  expect(innerDispose).toHaveBeenCalled();
});
