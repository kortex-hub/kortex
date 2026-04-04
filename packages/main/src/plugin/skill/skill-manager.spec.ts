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

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { IPCHandle } from '/@/plugin/api.js';
import type { Directories } from '/@/plugin/directories.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { IConfigurationRegistry } from '/@api/configuration/models.js';
import {
  SKILL_ENABLED,
  SKILL_FILE_NAME,
  SKILL_REGISTERED,
  SKILL_REMOVED,
  type SkillInfo,
} from '/@api/skill/skill-info.js';

import { SkillManager } from './skill-manager.js';

const SKILLS_DIR = resolve('/test/skills');

vi.mock('node:fs');
vi.mock('node:fs/promises');

const updateMock = vi.fn().mockResolvedValue(undefined);
const getMock = vi.fn();

const configurationRegistry = {
  registerConfigurations: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  getConfiguration: vi.fn().mockReturnValue({
    get: getMock,
    update: updateMock,
    has: vi.fn(),
  }),
} as unknown as IConfigurationRegistry;

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn(),
};

const directories = {
  getSkillsDirectory: vi.fn().mockReturnValue(SKILLS_DIR),
} as unknown as Directories;

const ipcHandle: IPCHandle = vi.fn();

const validSkillMd = `---
name: my-test-skill
description: A test skill for unit testing
---
# My Test Skill

Some instructions here.
`;

const secondSkillMd = `---
name: second-skill
description: A second test skill
---
# Second Skill
`;

const noFrontmatterSkillMd = `# My Test Skill

No frontmatter here.
`;

const missingNameSkillMd = `---
description: A skill without a name
---
# Unnamed Skill
`;

const missingDescriptionSkillMd = `---
name: no-description-skill
---
# No Description
`;

const originalConsoleWarn = console.warn;

function createSkillManager(): SkillManager {
  return new SkillManager(apiSender, configurationRegistry, directories, ipcHandle);
}

function mockDirectoryWithSkills(
  skillFolders: { name: string; content: string }[],
  baseDirectory: string = SKILLS_DIR,
): void {
  vi.mocked(existsSync).mockImplementation(p => {
    const path = String(p);
    if (path === baseDirectory) return true;
    return skillFolders.some(f => path === join(baseDirectory, f.name, SKILL_FILE_NAME));
  });
  vi.mocked(readdir).mockImplementation(async (p: unknown) => {
    const path = String(p);
    if (path === baseDirectory) {
      return skillFolders.map(f => ({
        name: f.name,
        isDirectory: (): boolean => true,
      })) as unknown as Awaited<ReturnType<typeof readdir>>;
    }
    return [] as unknown as Awaited<ReturnType<typeof readdir>>;
  });
  vi.mocked(readFile).mockImplementation(async (p: unknown) => {
    const path = String(p);
    const match = skillFolders.find(f => path === join(baseDirectory, f.name, SKILL_FILE_NAME));
    if (match) return match.content;
    throw new Error(`File not found: ${path}`);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  console.warn = vi.fn();
  getMock.mockReturnValue([]);
  updateMock.mockResolvedValue(undefined);
  vi.mocked(directories.getSkillsDirectory).mockReturnValue(SKILLS_DIR);
  vi.mocked(configurationRegistry.registerConfigurations).mockReturnValue({ dispose: vi.fn() });
  vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
    get: getMock,
    update: updateMock,
    has: vi.fn(),
  });
});

afterEach(() => {
  console.warn = originalConsoleWarn;
});

test('init should register configuration section with skills.enabled, skills.registered, and skills.removed', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  const skillManager = createSkillManager();
  await skillManager.init();

  expect(configurationRegistry.registerConfigurations).toHaveBeenCalledWith([
    expect.objectContaining({
      id: 'preferences.skills',
      title: 'Skills',
      properties: {
        'skills.enabled': expect.objectContaining({
          type: 'array',
          hidden: true,
        }),
        'skills.registered': expect.objectContaining({
          type: 'array',
          hidden: true,
        }),
        'skills.removed': expect.objectContaining({
          type: 'array',
          hidden: true,
        }),
      },
    }),
  ]);
});

test('init should discover skills from folder and mark enabled based on config', async () => {
  getMock.mockReturnValueOnce([]).mockReturnValueOnce(['my-test-skill']);
  mockDirectoryWithSkills([{ name: 'my-test-skill', content: validSkillMd }]);

  const skillManager = createSkillManager();
  await skillManager.init();

  expect(skillManager.listSkills()).toHaveLength(1);
  expect(skillManager.listSkills()[0]).toEqual(
    expect.objectContaining({
      name: 'my-test-skill',
      path: join(SKILLS_DIR, 'my-test-skill'),
      description: 'A test skill for unit testing',
      enabled: true,
    }),
  );
});

test('init should mark skill as disabled when not in skills.enabled', async () => {
  getMock.mockReturnValue(['other-skill']);
  mockDirectoryWithSkills([{ name: 'my-test-skill', content: validSkillMd }]);

  const skillManager = createSkillManager();
  await skillManager.init();

  expect(skillManager.listSkills().at(0)?.enabled).toBe(false);
});

test('init should enable newly discovered skills by default and save config', async () => {
  getMock.mockReturnValue([]);
  mockDirectoryWithSkills([{ name: 'my-test-skill', content: validSkillMd }]);

  const skillManager = createSkillManager();
  await skillManager.init();

  expect(skillManager.listSkills().at(0)?.enabled).toBe(true);
  expect(updateMock).toHaveBeenCalledWith(SKILL_ENABLED, ['my-test-skill']);
});

test('init should skip invalid skills in directory gracefully', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readdir).mockResolvedValue([{ name: 'bad-skill', isDirectory: (): boolean => true }] as unknown as Awaited<
    ReturnType<typeof readdir>
  >);
  vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

  const skillManager = createSkillManager();
  await skillManager.init();

  expect(console.warn).toHaveBeenCalled();
  expect(skillManager.listSkills()).toHaveLength(0);
});

test('init should return early when skills directory does not exist', async () => {
  vi.mocked(existsSync).mockReturnValue(false);

  const skillManager = createSkillManager();
  await skillManager.init();

  expect(skillManager.listSkills()).toHaveLength(0);
  expect(readdir).not.toHaveBeenCalled();
});

test('parseSkillFile should extract name and description from valid SKILL.md', async () => {
  vi.mocked(readFile).mockResolvedValue(validSkillMd);

  const skillManager = createSkillManager();
  const result = await skillManager.parseSkillFile('/test/SKILL.md');

  expect(result).toEqual({
    name: 'my-test-skill',
    description: 'A test skill for unit testing',
  });
});

test('parseSkillFile should throw on missing metadata', async () => {
  vi.mocked(readFile).mockResolvedValue(noFrontmatterSkillMd);

  const skillManager = createSkillManager();

  await expect(skillManager.parseSkillFile('/test/SKILL.md')).rejects.toThrow('No metadata found');
});

test('parseSkillFile should throw on missing name', async () => {
  vi.mocked(readFile).mockResolvedValue(missingNameSkillMd);

  const skillManager = createSkillManager();

  await expect(skillManager.parseSkillFile('/test/SKILL.md')).rejects.toThrow(`Missing or invalid 'name'`);
});

test('parseSkillFile should throw on missing description', async () => {
  vi.mocked(readFile).mockResolvedValue(missingDescriptionSkillMd);

  const skillManager = createSkillManager();

  await expect(skillManager.parseSkillFile('/test/SKILL.md')).rejects.toThrow(`Missing or invalid 'description'`);
});

test('parseSkillFile should throw when name exceeds 64 characters', async () => {
  const longName = 'a'.repeat(65);
  vi.mocked(readFile).mockResolvedValue(`---\nname: ${longName}\ndescription: Valid\n---\n`);

  const skillManager = createSkillManager();

  await expect(skillManager.parseSkillFile('/test/SKILL.md')).rejects.toThrow(`'name' exceeds 64 characters`);
});

test('parseSkillFile should throw when name contains uppercase or invalid characters', async () => {
  vi.mocked(readFile).mockResolvedValue('---\nname: My_Skill\ndescription: Valid\n---\n');

  const skillManager = createSkillManager();

  await expect(skillManager.parseSkillFile('/test/SKILL.md')).rejects.toThrow(
    `'name' must contain only lowercase letters, numbers, and hyphens`,
  );
});

test('parseSkillFile should throw when name contains reserved word', async () => {
  vi.mocked(readFile).mockResolvedValue('---\nname: my-claude-skill\ndescription: Valid\n---\n');

  const skillManager = createSkillManager();

  await expect(skillManager.parseSkillFile('/test/SKILL.md')).rejects.toThrow(`'name' contains a reserved word`);
});

test('parseSkillFile should throw when name contains XML tags', async () => {
  vi.mocked(readFile).mockResolvedValue(`---\nname: "<script>"\ndescription: Valid\n---\n`);

  const skillManager = createSkillManager();

  await expect(skillManager.parseSkillFile('/test/SKILL.md')).rejects.toThrow(
    `'name' must contain only lowercase letters, numbers, and hyphens`,
  );
});

test('parseSkillFile should throw when description exceeds 1024 characters', async () => {
  const longDesc = 'a'.repeat(1025);
  vi.mocked(readFile).mockResolvedValue(`---\nname: valid-skill\ndescription: ${longDesc}\n---\n`);

  const skillManager = createSkillManager();

  await expect(skillManager.parseSkillFile('/test/SKILL.md')).rejects.toThrow(`'description' exceeds 1024 characters`);
});

test('parseSkillFile should throw when description contains XML tags', async () => {
  vi.mocked(readFile).mockResolvedValue(
    `---\nname: valid-skill\ndescription: "Has <script>alert</script> tags"\n---\n`,
  );

  const skillManager = createSkillManager();

  await expect(skillManager.parseSkillFile('/test/SKILL.md')).rejects.toThrow(
    `'description' must not contain XML tags`,
  );
});

test('registerSkill should reference the original folder without copying', async () => {
  vi.mocked(existsSync).mockImplementation(p => String(p).endsWith(SKILL_FILE_NAME));
  vi.mocked(readFile).mockResolvedValue(validSkillMd);

  const skillManager = createSkillManager();
  await skillManager.init();
  const externalPath = resolve('/my/skill/folder');
  const skill = await skillManager.registerSkill(externalPath);

  expect(skill.name).toBe('my-test-skill');
  expect(skill.description).toBe('A test skill for unit testing');
  expect(skill.path).toBe(externalPath);
  expect(skill.enabled).toBe(true);
  expect(apiSender.send).toHaveBeenCalledWith('skill-manager-update');
  expect(updateMock).toHaveBeenCalledWith(SKILL_REGISTERED, [externalPath]);
});

test('registerSkill should throw when SKILL.md not found', async () => {
  vi.mocked(existsSync).mockReturnValue(false);

  const skillManager = createSkillManager();

  await expect(skillManager.registerSkill(resolve('/missing/folder'))).rejects.toThrow('SKILL.md not found');
});

test('registerSkill should throw on duplicate name', async () => {
  vi.mocked(existsSync).mockImplementation(p => String(p).endsWith(SKILL_FILE_NAME));
  vi.mocked(readFile).mockResolvedValue(validSkillMd);

  const skillManager = createSkillManager();
  await skillManager.registerSkill(resolve('/first/folder'));

  await expect(skillManager.registerSkill(resolve('/second/folder'))).rejects.toThrow(
    `Skill with name 'my-test-skill' already registered`,
  );
});

test('disableSkill should disable a registered skill', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readFile).mockResolvedValue(validSkillMd);

  const skillManager = createSkillManager();
  await skillManager.init();
  const skill = await skillManager.registerSkill(join(SKILLS_DIR, 'my-test-skill'));
  vi.mocked(apiSender.send).mockClear();
  updateMock.mockClear();

  skillManager.disableSkill(skill.name);

  expect(skillManager.listSkills()).toHaveLength(1);
  expect(skillManager.listSkills().at(0)?.enabled).toBe(false);
  expect(apiSender.send).toHaveBeenCalledWith('skill-manager-update');
  expect(updateMock).toHaveBeenCalled();
});

test('enableSkill should re-enable a disabled skill', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readFile).mockResolvedValue(validSkillMd);

  const skillManager = createSkillManager();
  await skillManager.init();
  const skill = await skillManager.registerSkill(join(SKILLS_DIR, 'my-test-skill'));
  skillManager.disableSkill(skill.name);
  expect(skillManager.listSkills().at(0)?.enabled).toBe(false);

  vi.mocked(apiSender.send).mockClear();
  updateMock.mockClear();

  skillManager.enableSkill(skill.name);

  expect(skillManager.listSkills().at(0)?.enabled).toBe(true);
  expect(apiSender.send).toHaveBeenCalledWith('skill-manager-update');
  expect(updateMock).toHaveBeenCalled();
});

test('disableSkill should throw when skill name not found', () => {
  const skillManager = createSkillManager();

  expect(skillManager.disableSkill.bind(skillManager, 'nonexistent')).toThrow('Skill not found with name');
});

test('enableSkill should throw when skill name not found', () => {
  const skillManager = createSkillManager();

  expect(skillManager.enableSkill.bind(skillManager, 'nonexistent')).toThrow('Skill not found with name');
});

test('unregisterSkill should delete folder for managed skills and not track as removed', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readFile).mockResolvedValue(validSkillMd);
  vi.mocked(rm).mockResolvedValue(undefined);

  const skillManager = createSkillManager();
  await skillManager.init();
  const skill = await skillManager.registerSkill(join(SKILLS_DIR, 'my-test-skill'));
  vi.mocked(apiSender.send).mockClear();
  updateMock.mockClear();

  await skillManager.unregisterSkill(skill.name);

  expect(skillManager.listSkills()).toHaveLength(0);
  expect(rm).toHaveBeenCalledWith(resolve(skill.path), { recursive: true, force: true });
  expect(apiSender.send).toHaveBeenCalledWith('skill-manager-update');
  expect(updateMock).toHaveBeenCalledWith(SKILL_REMOVED, []);
});

test('unregisterSkill should not delete folder for external skills and track as removed', async () => {
  vi.mocked(existsSync).mockImplementation(p => String(p).endsWith(SKILL_FILE_NAME));
  vi.mocked(readFile).mockResolvedValue(validSkillMd);

  const skillManager = createSkillManager();
  await skillManager.init();
  await skillManager.registerSkill('/external/skill/folder');
  vi.mocked(apiSender.send).mockClear();
  updateMock.mockClear();

  await skillManager.unregisterSkill('my-test-skill');

  expect(skillManager.listSkills()).toHaveLength(0);
  expect(rm).not.toHaveBeenCalled();
  expect(updateMock).toHaveBeenCalledWith(SKILL_REGISTERED, []);
  expect(updateMock).toHaveBeenCalledWith(SKILL_REMOVED, ['my-test-skill']);
});

test('unregisterSkill should throw when skill name not found', async () => {
  const skillManager = createSkillManager();

  await expect(skillManager.unregisterSkill('nonexistent')).rejects.toThrow('Skill not found with name');
});

test('listSkills should return empty array when no skills registered', () => {
  const skillManager = createSkillManager();

  expect(skillManager.listSkills()).toEqual([]);
});

test('listSkills should return all registered skills', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readFile).mockResolvedValueOnce(validSkillMd).mockResolvedValueOnce(secondSkillMd);

  const skillManager = createSkillManager();
  await skillManager.registerSkill(join(SKILLS_DIR, 'my-test-skill'));
  await skillManager.registerSkill(join(SKILLS_DIR, 'second-skill'));

  const skills = skillManager.listSkills();
  expect(skills).toHaveLength(2);
  expect(skills.map((s: SkillInfo) => s.name)).toEqual(expect.arrayContaining(['my-test-skill', 'second-skill']));
});

test('getSkillContent should return the SKILL.md content for a registered skill', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readFile).mockResolvedValue(validSkillMd);

  const skillManager = createSkillManager();
  const skill = await skillManager.registerSkill(join(SKILLS_DIR, 'my-test-skill'));

  vi.mocked(readFile).mockResolvedValue('full markdown content');

  const content = await skillManager.getSkillContent('my-test-skill');
  expect(content).toBe('full markdown content');
  expect(readFile).toHaveBeenCalledWith(join(skill.path, 'SKILL.md'), 'utf-8');
});

test('getSkillContent should throw when skill name not found', async () => {
  const skillManager = createSkillManager();

  await expect(skillManager.getSkillContent('nonexistent')).rejects.toThrow('Skill not found with name');
});

test('listSkillFolderContent should return folder entries for a registered skill', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readFile).mockResolvedValue(validSkillMd);

  const skillManager = createSkillManager();
  const skill = await skillManager.registerSkill(join(SKILLS_DIR, 'my-test-skill'));

  vi.mocked(readdir).mockResolvedValue(['SKILL.md', 'utils.ts', 'templates'] as unknown as Awaited<
    ReturnType<typeof readdir>
  >);

  const entries = await skillManager.listSkillFolderContent('my-test-skill');
  expect(entries).toEqual(['SKILL.md', 'utils.ts', 'templates']);
  expect(readdir).toHaveBeenCalledWith(skill.path);
});

test('listSkillFolderContent should throw when skill name not found', async () => {
  const skillManager = createSkillManager();

  await expect(skillManager.listSkillFolderContent('nonexistent')).rejects.toThrow('Skill not found with name');
});

test('createSkill should create a SKILL.md and register the skill', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  vi.mocked(mkdir).mockResolvedValue(undefined);
  vi.mocked(writeFile).mockResolvedValue(undefined);

  const skillManager = createSkillManager();
  await skillManager.init();
  const skill = await skillManager.createSkill(
    { name: 'new-skill', description: 'A new skill', content: '# New Skill\n\nInstructions here.' },
    SKILLS_DIR,
  );

  const expectedDir = join(SKILLS_DIR, 'new-skill');
  expect(skill.name).toBe('new-skill');
  expect(skill.description).toBe('A new skill');
  expect(skill.path).toBe(expectedDir);
  expect(skill.enabled).toBe(true);
  expect(mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
  expect(writeFile).toHaveBeenCalledWith(
    join(expectedDir, 'SKILL.md'),
    expect.stringContaining('name: new-skill'),
    'utf-8',
  );
  expect(apiSender.send).toHaveBeenCalledWith('skill-manager-update');
  expect(updateMock).toHaveBeenCalled();
});

test('createSkill should strip existing frontmatter from content', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  vi.mocked(mkdir).mockResolvedValue(undefined);
  vi.mocked(writeFile).mockResolvedValue(undefined);

  const skillManager = createSkillManager();
  await skillManager.init();
  await skillManager.createSkill(
    {
      name: 'imported-skill',
      description: 'Overridden description',
      content: '---\nname: old-name\ndescription: old desc\n---\n\n# Body content',
    },
    SKILLS_DIR,
  );

  const writtenContent = vi.mocked(writeFile).mock.calls[0]![1] as string;
  expect(writtenContent).toContain('name: imported-skill');
  expect(writtenContent).toContain('description: Overridden description');
  expect(writtenContent).not.toContain('old-name');
  expect(writtenContent).not.toContain('old desc');
  expect(writtenContent).toContain('# Body content');
});

test('createSkill should throw on duplicate name', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readFile).mockResolvedValue(validSkillMd);

  const skillManager = createSkillManager();
  await skillManager.init();
  await skillManager.registerSkill(join(SKILLS_DIR, 'my-test-skill'));

  await expect(
    skillManager.createSkill({ name: 'my-test-skill', description: 'Duplicate', content: '# Dup' }, SKILLS_DIR),
  ).rejects.toThrow(`Skill with name 'my-test-skill' already registered`);
});

test('createSkill should throw when directory already exists', async () => {
  vi.mocked(existsSync).mockReturnValue(true);

  const skillManager = createSkillManager();
  await skillManager.init();

  await expect(
    skillManager.createSkill({ name: 'existing-dir', description: 'Exists', content: '# Exists' }, SKILLS_DIR),
  ).rejects.toThrow('Skill directory already exists');
});

test('createSkill should throw on invalid name', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  const skillManager = createSkillManager();
  await skillManager.init();

  await expect(
    skillManager.createSkill({ name: 'Invalid_Name', description: 'Bad name', content: '# Bad' }, SKILLS_DIR),
  ).rejects.toThrow(`'name' must contain only lowercase letters, numbers, and hyphens`);
});

test('createSkill should reject name containing colons', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  const skillManager = createSkillManager();
  await skillManager.init();

  await expect(
    skillManager.createSkill(
      { name: 'team:my-skill', description: 'Colons are invalid', content: '# Bad' },
      SKILLS_DIR,
    ),
  ).rejects.toThrow(`'name' must contain only lowercase letters, numbers, and hyphens`);
});

test('createSkill with extension-registered target should write to that target directory', async () => {
  const CUSTOM_DIR = resolve('/custom/skills');
  vi.mocked(existsSync).mockReturnValue(false);
  vi.mocked(mkdir).mockResolvedValue(undefined);
  vi.mocked(writeFile).mockResolvedValue(undefined);

  const skillManager = createSkillManager();
  await skillManager.init();
  skillManager.registerSkillFolder({
    label: 'Custom Skills',
    badge: 'Custom',
    baseDirectory: CUSTOM_DIR,
  });
  const skill = await skillManager.createSkill(
    { name: 'new-skill', description: 'A custom skill', content: '# Custom Skill' },
    CUSTOM_DIR,
  );

  const expectedDir = join(CUSTOM_DIR, 'new-skill');
  expect(skill.path).toBe(expectedDir);
  expect(mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
  expect(writeFile).toHaveBeenCalledWith(
    join(expectedDir, 'SKILL.md'),
    expect.stringContaining('name: new-skill'),
    'utf-8',
  );
});

test('createSkill should throw when target is not registered', async () => {
  vi.mocked(existsSync).mockReturnValue(false);

  const skillManager = createSkillManager();
  await skillManager.init();

  await expect(
    skillManager.createSkill({ name: 'some-skill', description: 'A skill', content: '# Content' }, '/unknown/target'),
  ).rejects.toThrow(`Unknown skill folder: '/unknown/target'`);
});

test('registerSkillFolder should register and return disposable', async () => {
  vi.mocked(existsSync).mockReturnValue(false);

  const skillManager = createSkillManager();
  await skillManager.init();

  const disposable = skillManager.registerSkillFolder({
    label: 'Test Target',
    badge: 'Test',
    baseDirectory: '/test/target/skills',
  });

  expect(skillManager.listSkillFolders()).toHaveLength(2);
  expect(skillManager.listSkillFolders().find(t => t.baseDirectory === '/test/target/skills')).toBeDefined();
  expect(apiSender.send).toHaveBeenCalledWith('skill-folders-update');

  disposable.dispose();
  expect(skillManager.listSkillFolders()).toHaveLength(1);
  expect(skillManager.listSkillFolders().find(t => t.baseDirectory === '/test/target/skills')).toBeUndefined();
});

test('registerSkillFolder should throw on duplicate baseDirectory', async () => {
  vi.mocked(existsSync).mockReturnValue(false);

  const skillManager = createSkillManager();
  await skillManager.init();

  expect(() =>
    skillManager.registerSkillFolder({
      label: 'Duplicate',
      badge: 'Dup',
      baseDirectory: SKILLS_DIR,
    }),
  ).toThrow(`Skill folder '${SKILLS_DIR}' is already registered`);
});

test('listSkillFolders should include built-in kortex folder after init', async () => {
  vi.mocked(existsSync).mockReturnValue(false);

  const skillManager = createSkillManager();
  await skillManager.init();

  const targets = skillManager.listSkillFolders();
  expect(targets).toHaveLength(1);
  expect(targets[0]).toEqual(
    expect.objectContaining({
      label: 'Kortex Skills',
      badge: 'Kortex',
      baseDirectory: SKILLS_DIR,
    }),
  );
});

test('registerSkillFolder should discover skills from its directory after init', async () => {
  const EXTRA_DIR = resolve('/extra/skills');
  mockDirectoryWithSkills(
    [{ name: 'extra-skill', content: `---\nname: extra-skill\ndescription: An extra skill\n---\n# Extra\n` }],
    EXTRA_DIR,
  );

  const skillManager = createSkillManager();
  await skillManager.init();
  skillManager.registerSkillFolder({
    label: 'Extra',
    badge: 'Extra',
    baseDirectory: EXTRA_DIR,
  });

  await vi.waitFor(() => {
    const skills = skillManager.listSkills();
    expect(skills.some(s => s.path === join(EXTRA_DIR, 'extra-skill'))).toBe(true);
  });
});

test('disposing a skill folder should remove its skills from the list', async () => {
  const EXTRA_DIR = resolve('/extra/skills');
  mockDirectoryWithSkills(
    [{ name: 'extra-skill', content: `---\nname: extra-skill\ndescription: An extra skill\n---\n# Extra\n` }],
    EXTRA_DIR,
  );

  const skillManager = createSkillManager();
  await skillManager.init();

  const disposable = skillManager.registerSkillFolder({
    label: 'Extra',
    badge: 'Extra',
    baseDirectory: EXTRA_DIR,
  });

  await vi.waitFor(() => {
    expect(skillManager.listSkills().some(s => s.name === 'extra-skill')).toBe(true);
  });

  disposable.dispose();

  expect(skillManager.listSkills().some(s => s.name === 'extra-skill')).toBe(false);
  expect(skillManager.listSkillFolders().find(t => t.baseDirectory === EXTRA_DIR)).toBeUndefined();
  expect(apiSender.send).toHaveBeenCalledWith('skill-manager-update');
});

test('getSkillFileContent should return parsed metadata and body from a SKILL.md file', async () => {
  vi.mocked(readFile).mockResolvedValue(validSkillMd);

  const skillManager = createSkillManager();
  const result = await skillManager.getSkillFileContent('/path/to/SKILL.md');

  expect(result).toEqual({
    name: 'my-test-skill',
    description: 'A test skill for unit testing',
    content: '# My Test Skill\n\nSome instructions here.',
  });
  expect(readFile).toHaveBeenCalledWith('/path/to/SKILL.md', 'utf-8');
});

test('getSkillFileContent should throw when file has no frontmatter', async () => {
  vi.mocked(readFile).mockResolvedValue(noFrontmatterSkillMd);

  const skillManager = createSkillManager();

  await expect(skillManager.getSkillFileContent('/path/to/SKILL.md')).rejects.toThrow('No metadata found');
});

test('saveSkillsToConfig should write only enabled skill names', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readFile).mockResolvedValueOnce(validSkillMd).mockResolvedValueOnce(secondSkillMd);

  const skillManager = createSkillManager();
  await skillManager.init();
  await skillManager.registerSkill(join(SKILLS_DIR, 'my-test-skill'));
  await skillManager.registerSkill(join(SKILLS_DIR, 'second-skill'));
  skillManager.disableSkill('second-skill');

  expect(updateMock).toHaveBeenCalledWith(SKILL_ENABLED, ['my-test-skill']);
});

test('removed external skill should not be re-added on rediscovery', async () => {
  const EXTERNAL_DIR = resolve('/external/skills');
  mockDirectoryWithSkills(
    [{ name: 'ext-skill', content: `---\nname: ext-skill\ndescription: An external skill\n---\n# External\n` }],
    EXTERNAL_DIR,
  );

  const skillManager = createSkillManager();
  await skillManager.init();

  skillManager.registerSkillFolder({
    label: 'External',
    badge: 'Ext',
    baseDirectory: EXTERNAL_DIR,
  });

  await vi.waitFor(() => {
    expect(skillManager.listSkills().some(s => s.name === 'ext-skill')).toBe(true);
  });

  await skillManager.unregisterSkill('ext-skill');
  expect(skillManager.listSkills()).toHaveLength(0);
  expect(rm).not.toHaveBeenCalled();
  expect(updateMock).toHaveBeenCalledWith(SKILL_REMOVED, ['ext-skill']);

  skillManager.registerSkillFolder({
    label: 'External Again',
    badge: 'Ext2',
    baseDirectory: resolve('/external2/skills'),
  });

  await vi.waitFor(() => {
    expect(skillManager.listSkills().some(s => s.name === 'ext-skill')).toBe(false);
  });
});

test('skills from extension-registered folders should not be considered managed', async () => {
  const EXTENSION_DIR = resolve('/extension/skills');
  mockDirectoryWithSkills([{ name: 'my-test-skill', content: validSkillMd }], EXTENSION_DIR);

  const skillManager = createSkillManager();
  await skillManager.init();

  skillManager.registerSkillFolder({
    label: 'Extension',
    badge: 'Ext',
    baseDirectory: EXTENSION_DIR,
  });

  await vi.waitFor(() => {
    expect(skillManager.listSkills().some(s => s.name === 'my-test-skill')).toBe(true);
  });

  await skillManager.unregisterSkill('my-test-skill');

  expect(rm).not.toHaveBeenCalled();
  expect(updateMock).toHaveBeenCalledWith(SKILL_REMOVED, ['my-test-skill']);
});

test('init should load removed names from config and skip those skills during discovery', async () => {
  getMock.mockReturnValueOnce(['my-test-skill']);
  mockDirectoryWithSkills([{ name: 'my-test-skill', content: validSkillMd }]);

  const skillManager = createSkillManager();
  await skillManager.init();

  expect(skillManager.listSkills()).toHaveLength(0);
});

test('unregistering multiple external skills should accumulate removed names', async () => {
  const EXTERNAL_DIR = resolve('/external/skills');
  mockDirectoryWithSkills(
    [
      { name: 'skill-a', content: `---\nname: skill-a\ndescription: Skill A\n---\n# A\n` },
      { name: 'skill-b', content: `---\nname: skill-b\ndescription: Skill B\n---\n# B\n` },
    ],
    EXTERNAL_DIR,
  );

  const skillManager = createSkillManager();
  await skillManager.init();
  skillManager.registerSkillFolder({
    label: 'External',
    badge: 'Ext',
    baseDirectory: EXTERNAL_DIR,
  });

  await vi.waitFor(() => {
    expect(skillManager.listSkills()).toHaveLength(2);
  });

  await skillManager.unregisterSkill('skill-a');
  expect(updateMock).toHaveBeenCalledWith(SKILL_REMOVED, ['skill-a']);

  updateMock.mockClear();
  await skillManager.unregisterSkill('skill-b');
  expect(updateMock).toHaveBeenCalledWith(SKILL_REMOVED, expect.arrayContaining(['skill-a', 'skill-b']));
  expect(skillManager.listSkills()).toHaveLength(0);
  expect(rm).not.toHaveBeenCalled();
});

test('removed skill from skills.registered config should not reappear on init', async () => {
  const externalPath = resolve('/external/registered-skill');

  getMock.mockReturnValueOnce(['my-test-skill']).mockReturnValueOnce([externalPath]);

  vi.mocked(existsSync).mockImplementation(p => {
    const path = String(p);
    return path === join(externalPath, SKILL_FILE_NAME);
  });
  vi.mocked(readFile).mockImplementation(async (p: unknown) => {
    const path = String(p);
    if (path === join(externalPath, SKILL_FILE_NAME)) return validSkillMd;
    throw new Error(`File not found: ${path}`);
  });

  const skillManager = createSkillManager();
  await skillManager.init();

  expect(skillManager.listSkills()).toHaveLength(0);
});

test('createSkill in extension-registered folder should not be treated as managed on unregister', async () => {
  const CUSTOM_DIR = resolve('/custom/skills');
  vi.mocked(existsSync).mockReturnValue(false);
  vi.mocked(mkdir).mockResolvedValue(undefined);
  vi.mocked(writeFile).mockResolvedValue(undefined);

  const skillManager = createSkillManager();
  await skillManager.init();
  skillManager.registerSkillFolder({
    label: 'Custom',
    badge: 'Custom',
    baseDirectory: CUSTOM_DIR,
  });

  await skillManager.createSkill(
    { name: 'custom-skill', description: 'A custom skill', content: '# Custom' },
    CUSTOM_DIR,
  );

  updateMock.mockClear();
  await skillManager.unregisterSkill('custom-skill');

  expect(rm).not.toHaveBeenCalled();
  expect(updateMock).toHaveBeenCalledWith(SKILL_REMOVED, ['custom-skill']);
});

test('init should discover non-removed skills while skipping removed ones', async () => {
  getMock.mockReturnValueOnce(['my-test-skill']);
  mockDirectoryWithSkills([
    { name: 'my-test-skill', content: validSkillMd },
    { name: 'second-skill', content: secondSkillMd },
  ]);

  const skillManager = createSkillManager();
  await skillManager.init();

  expect(skillManager.listSkills()).toHaveLength(1);
  expect(skillManager.listSkills()[0]?.name).toBe('second-skill');
});

test('re-registering same external folder should still skip removed skills', async () => {
  const EXTERNAL_DIR = resolve('/external/skills');
  mockDirectoryWithSkills(
    [{ name: 'ext-skill', content: `---\nname: ext-skill\ndescription: An external skill\n---\n# External\n` }],
    EXTERNAL_DIR,
  );

  const skillManager = createSkillManager();
  await skillManager.init();

  const disposable = skillManager.registerSkillFolder({
    label: 'External',
    badge: 'Ext',
    baseDirectory: EXTERNAL_DIR,
  });

  await vi.waitFor(() => {
    expect(skillManager.listSkills().some(s => s.name === 'ext-skill')).toBe(true);
  });

  await skillManager.unregisterSkill('ext-skill');
  disposable.dispose();

  skillManager.registerSkillFolder({
    label: 'External',
    badge: 'Ext',
    baseDirectory: EXTERNAL_DIR,
  });

  await vi.waitFor(() => {
    expect(skillManager.listSkills().some(s => s.name === 'ext-skill')).toBe(false);
  });
});
