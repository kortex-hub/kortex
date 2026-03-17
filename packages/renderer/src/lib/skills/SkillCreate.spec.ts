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
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import SkillCreate from './SkillCreate.svelte';

const closeMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(window.createSkill).mockResolvedValue({
    name: 'test-skill',
    description: 'A test skill',
    path: '/skills/test-skill',
    enabled: true,
  });
});

test('should render the Create Skill dialog title', () => {
  render(SkillCreate, { onclose: closeMock });

  expect(screen.getByText('Create Skill')).toBeInTheDocument();
});

test('should render target cards, name, description, and content fields', () => {
  render(SkillCreate, { onclose: closeMock });

  expect(screen.getByText('Target')).toBeInTheDocument();
  expect(screen.getByText('Kortex Skills')).toBeInTheDocument();
  expect(screen.getByText('Claude Skills')).toBeInTheDocument();
  expect(screen.getByLabelText('Skill name')).toBeInTheDocument();
  expect(screen.getByLabelText('Skill description')).toBeInTheDocument();
  expect(screen.getByLabelText('Skill content')).toBeInTheDocument();
});

test('should render the drag/drop zone', () => {
  render(SkillCreate, { onclose: closeMock });

  expect(screen.getByLabelText('Drop or click to select a SKILL.md file')).toBeInTheDocument();
  expect(screen.getByText(/Choose file/)).toBeInTheDocument();
  expect(screen.getByText('Supported formats: .md')).toBeInTheDocument();
});

test('should have Create button disabled when fields are empty', () => {
  render(SkillCreate, { onclose: closeMock });

  const createButton = screen.getByRole('button', { name: 'Create' });
  expect(createButton).toBeDisabled();
});

test('should call onclose when Cancel is clicked', async () => {
  render(SkillCreate, { onclose: closeMock });

  const cancelButton = screen.getByRole('button', { name: 'Cancel' });
  await fireEvent.click(cancelButton);

  expect(closeMock).toHaveBeenCalled();
});

test('should enable Create button when all fields are filled', async () => {
  render(SkillCreate, { onclose: closeMock });

  const nameInput = screen.getByLabelText('Skill name');
  const descInput = screen.getByLabelText('Skill description');
  const contentArea = screen.getByLabelText('Skill content');

  await userEvent.type(nameInput, 'test-skill');
  await userEvent.type(descInput, 'A test skill');
  await userEvent.type(contentArea, 'Some content');

  const createButton = screen.getByRole('button', { name: 'Create' });
  expect(createButton).toBeEnabled();
});

test('should call createSkill with correct parameters and close on success', async () => {
  render(SkillCreate, { onclose: closeMock });

  const nameInput = screen.getByLabelText('Skill name');
  const descInput = screen.getByLabelText('Skill description');
  const contentArea = screen.getByLabelText('Skill content');

  await userEvent.type(nameInput, 'test-skill');
  await userEvent.type(descInput, 'A test skill');
  await userEvent.type(contentArea, 'Some content');

  const createButton = screen.getByRole('button', { name: 'Create' });
  await fireEvent.click(createButton);

  expect(window.createSkill).toHaveBeenCalledWith(
    { name: 'test-skill', description: 'A test skill', content: 'Some content' },
    'kortex',
  );
  expect(closeMock).toHaveBeenCalled();
});

test('should call createSkill with claude target when Claude card is selected', async () => {
  render(SkillCreate, { onclose: closeMock });

  const claudeCard = screen.getByLabelText('claude');
  await fireEvent.click(claudeCard);

  const nameInput = screen.getByLabelText('Skill name');
  const descInput = screen.getByLabelText('Skill description');
  const contentArea = screen.getByLabelText('Skill content');

  await userEvent.type(nameInput, 'test-skill');
  await userEvent.type(descInput, 'A test skill');
  await userEvent.type(contentArea, 'Some content');

  const createButton = screen.getByRole('button', { name: 'Create' });
  await fireEvent.click(createButton);

  expect(window.createSkill).toHaveBeenCalledWith(expect.any(Object), 'claude');
});

test('should display error when createSkill fails', async () => {
  vi.mocked(window.createSkill).mockRejectedValue(new Error('Skill already exists'));

  render(SkillCreate, { onclose: closeMock });

  const nameInput = screen.getByLabelText('Skill name');
  const descInput = screen.getByLabelText('Skill description');
  const contentArea = screen.getByLabelText('Skill content');

  await userEvent.type(nameInput, 'test-skill');
  await userEvent.type(descInput, 'A test skill');
  await userEvent.type(contentArea, 'Some content');

  const createButton = screen.getByRole('button', { name: 'Create' });
  await fireEvent.click(createButton);

  expect(await screen.findByText(/Skill already exists/)).toBeInTheDocument();
  expect(closeMock).not.toHaveBeenCalled();
});

test('should render drop zone with correct label', () => {
  render(SkillCreate, { onclose: closeMock });

  const dropZone = screen.getByRole('button', { name: 'Drop or click to select a SKILL.md file' });
  expect(dropZone).toBeInTheDocument();
});

test('should open file dialog when drop zone is clicked', async () => {
  vi.mocked(window.openDialog).mockResolvedValue(['/home/user/skills/SKILL.md']);
  vi.mocked(window.getSkillFileContent).mockResolvedValue({
    name: 'parsed-skill',
    description: 'Parsed description',
    content: '# Body',
  });

  render(SkillCreate, { onclose: closeMock });

  const dropZone = screen.getByLabelText('Drop or click to select a SKILL.md file');
  await fireEvent.click(dropZone);

  expect(window.openDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Select a SKILL.md file',
      selectors: ['openFile'],
    }),
  );
});

test('should prefill fields from parsed file when browsing', async () => {
  vi.mocked(window.openDialog).mockResolvedValue(['/home/user/skills/SKILL.md']);
  vi.mocked(window.getSkillFileContent).mockResolvedValue({
    name: 'parsed-skill',
    description: 'Parsed description',
    content: '# Body content',
  });

  render(SkillCreate, { onclose: closeMock });

  const dropZone = screen.getByLabelText('Drop or click to select a SKILL.md file');
  await fireEvent.click(dropZone);

  await vi.waitFor(() => {
    expect(screen.getByLabelText('Skill name')).toHaveValue('parsed-skill');
    expect(screen.getByLabelText('Skill description')).toHaveValue('Parsed description');
    expect(screen.getByLabelText('Skill content')).toHaveValue('# Body content');
  });

  const createButton = screen.getByRole('button', { name: 'Create' });
  await fireEvent.click(createButton);

  expect(window.createSkill).toHaveBeenCalledWith(
    { name: 'parsed-skill', description: 'Parsed description', content: '# Body content' },
    'kortex',
  );
});
