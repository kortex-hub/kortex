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

import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import { beforeEach, expect, test, vi } from 'vitest';

import * as skillsStore from '/@/stores/skills';
import type { SkillInfo } from '/@api/skill/skill-info';

import SkillsList from './SkillsList.svelte';

vi.mock(import('/@/stores/skills'));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(skillsStore).filteredSkillInfos = writable<SkillInfo[]>([]);
  vi.mocked(skillsStore).skillSearchPattern = writable('');
  vi.mocked(window.listSkillFolders).mockResolvedValue([
    { label: 'Kaiden Skills', badge: 'Kaiden', baseDirectory: '/test/skills' },
  ]);
});

test('should show empty screen when no skills', () => {
  render(SkillsList);

  expect(screen.getByText('No skills')).toBeInTheDocument();
});

test('should show the "New skill" buttons', () => {
  render(SkillsList);

  const buttons = screen.getAllByText('New skill');
  expect(buttons.length).toBeGreaterThanOrEqual(1);
});

test('should show table when skills exist', () => {
  const skills: SkillInfo[] = [
    { name: 'skill-a', description: 'First skill', path: '/skills/skill-a', enabled: true },
    { name: 'skill-b', description: 'Second skill', path: '/skills/skill-b', enabled: false },
  ];
  vi.mocked(skillsStore).filteredSkillInfos = writable(skills);

  render(SkillsList);

  expect(screen.getByText('skill-a')).toBeInTheDocument();
  expect(screen.getByText('skill-b')).toBeInTheDocument();
});

test('should open the create dialog when "New skill" is clicked', async () => {
  render(SkillsList);

  const buttons = screen.getAllByText('New skill');
  await fireEvent.click(buttons[0]);

  expect(screen.getByText('Create Skill')).toBeInTheDocument();
});
