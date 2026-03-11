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

import type { Configuration } from '@kortex-app/api';
import { inject, injectable, preDestroy } from 'inversify';
import { dump, load } from 'js-yaml';

import { IPCHandle } from '/@/plugin/api.js';
import { Directories } from '/@/plugin/directories.js';
import { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { IConfigurationNode } from '/@api/configuration/models.js';
import { IConfigurationRegistry } from '/@api/configuration/models.js';
import type { IDisposable } from '/@api/disposable.js';
import {
  SKILL_ENABLED,
  SKILL_FILE_NAME,
  SKILL_REGISTERED,
  SKILL_SECTION,
  type SkillCreateOptions,
  type SkillInfo,
  type SkillMetadata,
} from '/@api/skill/skill-info.js';

const RESERVED_WORDS = ['anthropic', 'claude'];
const XML_TAG_PATTERN = /<[a-zA-Z/][a-zA-Z0-9 "'=/]*>/;

@injectable()
export class SkillManager {
  private skills: SkillInfo[] = [];
  private configuration: Configuration | undefined;
  private disposables: IDisposable[] = [];

  constructor(
    @inject(ApiSenderType) private readonly apiSender: ApiSenderType,
    @inject(IConfigurationRegistry) private readonly configurationRegistry: IConfigurationRegistry,
    @inject(Directories) private readonly directories: Directories,
    @inject(IPCHandle) private readonly ipcHandle: IPCHandle,
  ) {}

  /**
   * Discovers skills from the skills directory, registers IPC handlers,
   * and enables newly found skills by default.
   */
  async init(): Promise<void> {
    const skillsConfiguration: IConfigurationNode = {
      id: 'preferences.skills',
      title: 'Skills',
      type: 'object',
      properties: {
        [`${SKILL_SECTION}.${SKILL_ENABLED}`]: {
          description: 'Enabled skills',
          type: 'array',
          hidden: true,
        },
        [`${SKILL_SECTION}.${SKILL_REGISTERED}`]: {
          description: 'Registered external skill paths',
          type: 'array',
          hidden: true,
        },
      },
    };
    this.disposables.push(this.configurationRegistry.registerConfigurations([skillsConfiguration]));
    this.configuration = this.configurationRegistry.getConfiguration(SKILL_SECTION);

    await this.discoverSkills();

    this.ipcHandle('skill-manager:listSkills', async (): Promise<SkillInfo[]> => {
      return this.listSkills();
    });

    this.ipcHandle('skill-manager:registerSkill', async (_listener, folderPath: string): Promise<SkillInfo> => {
      return this.registerSkill(folderPath);
    });

    this.ipcHandle('skill-manager:disableSkill', async (_listener, name: string): Promise<void> => {
      return this.disableSkill(name);
    });

    this.ipcHandle('skill-manager:enableSkill', async (_listener, name: string): Promise<void> => {
      return this.enableSkill(name);
    });

    this.ipcHandle('skill-manager:unregisterSkill', async (_listener, name: string): Promise<void> => {
      return this.unregisterSkill(name);
    });

    this.ipcHandle('skill-manager:createSkill', async (_listener, options: SkillCreateOptions): Promise<SkillInfo> => {
      return this.createSkill(options);
    });

    this.ipcHandle('skill-manager:getSkillContent', async (_listener, name: string): Promise<string> => {
      return this.getSkillContent(name);
    });

    this.ipcHandle('skill-manager:listSkillFolderContent', async (_listener, name: string): Promise<string[]> => {
      return this.listSkillFolderContent(name);
    });
  }

  /**
   * Parses a SKILL.md file, extracting YAML frontmatter (name, description)
   * and validating metadata against naming constraints.
   */
  async parseSkillFile(filePath: string): Promise<SkillMetadata> {
    const rawContent = (await readFile(filePath, 'utf-8')).trimStart();
    const metadata = this.extractFrontmatter(rawContent, filePath);
    this.validateMetadata(metadata, filePath);
    return metadata;
  }

  private extractFrontmatter(rawContent: string, filePath: string): SkillMetadata {
    const DELIMITER = '---';
    if (!rawContent.startsWith(DELIMITER)) {
      throw new Error(`No metadata found in ${filePath}`);
    }

    const endIndex = rawContent.indexOf(`\n${DELIMITER}`, DELIMITER.length);
    if (endIndex === -1) {
      throw new Error(`Unclosed metadata block in ${filePath}`);
    }

    const yamlBlock = rawContent.slice(DELIMITER.length + 1, endIndex);
    const parsed = load(yamlBlock);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Invalid metadata in ${filePath}`);
    }

    return parsed as SkillMetadata;
  }

  private validateMetadata(metadata: SkillMetadata, filePath: string): void {
    if (typeof metadata.name !== 'string' || !metadata.name) {
      throw new Error(`Missing or invalid 'name' in ${filePath}`);
    }

    // Requirements specified in the Claude documentation:
    // https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview#skill-structure
    if (metadata.name.length > 64) {
      throw new Error(`'name' exceeds 64 characters in ${filePath}`);
    }
    if (!/^[a-z0-9-]+$/.test(metadata.name)) {
      throw new Error(`'name' must contain only lowercase letters, numbers, and hyphens in ${filePath}`);
    }
    if (RESERVED_WORDS.some(word => metadata.name.includes(word))) {
      throw new Error(`'name' contains a reserved word in ${filePath}`);
    }
    if (XML_TAG_PATTERN.test(metadata.name)) {
      throw new Error(`'name' must not contain XML tags in ${filePath}`);
    }

    if (typeof metadata.description !== 'string' || !metadata.description) {
      throw new Error(`Missing or invalid 'description' in ${filePath}`);
    }
    if (metadata.description.length > 1024) {
      throw new Error(`'description' exceeds 1024 characters in ${filePath}`);
    }
    if (XML_TAG_PATTERN.test(metadata.description)) {
      throw new Error(`'description' must not contain XML tags in ${filePath}`);
    }
  }

  /**
   * Registers a skill from an external folder by storing a reference to its
   * path. The original folder is not copied. The skill is enabled immediately
   * and the reference is persisted to config.
   */
  async registerSkill(folderPath: string): Promise<SkillInfo> {
    const resolvedPath = resolve(folderPath);
    const skillFilePath = join(resolvedPath, SKILL_FILE_NAME);

    if (!existsSync(skillFilePath)) {
      throw new Error(`${SKILL_FILE_NAME} not found in ${resolvedPath}`);
    }

    const metadata = await this.parseSkillFile(skillFilePath);

    const duplicate = this.skills.find(s => s.name === metadata.name);
    if (duplicate) {
      throw new Error(`Skill with name '${metadata.name}' already registered at path: ${duplicate.path}`);
    }

    const skill: SkillInfo = {
      ...metadata,
      path: resolvedPath,
      enabled: true,
    };

    this.skills = [...this.skills, skill];
    this.saveSkillsToConfig();
    this.apiSender.send('skill-manager-update');
    return skill;
  }

  /**
   * Creates a new skill by writing a SKILL.md file with the given name,
   * description, and content into the skills directory. The skill is
   * enabled immediately and persisted to config.
   */
  async createSkill(options: SkillCreateOptions): Promise<SkillInfo> {
    const metadata: SkillMetadata = { name: options.name, description: options.description };
    this.validateMetadata(metadata, SKILL_FILE_NAME);

    const duplicate = this.skills.find(s => s.name === metadata.name);
    if (duplicate) {
      throw new Error(`Skill with name '${metadata.name}' already registered at path: ${duplicate.path}`);
    }

    const skillsDir = this.directories.getSkillsDirectory();
    const skillDir = join(skillsDir, metadata.name);

    if (existsSync(skillDir)) {
      throw new Error(`Skill directory already exists: ${skillDir}`);
    }

    await mkdir(skillDir, { recursive: true });

    const frontmatter = dump({ name: metadata.name, description: metadata.description }).trimEnd();
    const fileContent = `---\n${frontmatter}\n---\n\n${options.content}`;
    await writeFile(join(skillDir, SKILL_FILE_NAME), fileContent, 'utf-8');

    const skill: SkillInfo = {
      ...metadata,
      path: skillDir,
      enabled: true,
    };
    this.skills = [...this.skills, skill];
    this.saveSkillsToConfig();
    this.apiSender.send('skill-manager-update');
    return skill;
  }

  /**
   * Disables a skill by removing its name from the `skills.enabled` config.
   * The skill folder remains on disk and the skill stays visible in the list.
   */
  disableSkill(name: string): void {
    const skill = this.findSkillByName(name);
    skill.enabled = false;
    this.skills = [...this.skills];
    this.saveSkillsToConfig();
    this.apiSender.send('skill-manager-update');
  }

  /**
   * Enables a previously disabled skill by adding its name back
   * to the `skills.enabled` config.
   */
  enableSkill(name: string): void {
    const skill = this.findSkillByName(name);
    skill.enabled = true;
    this.skills = [...this.skills];
    this.saveSkillsToConfig();
    this.apiSender.send('skill-manager-update');
  }

  /**
   * Removes a skill from the registry and config. If the skill lives inside
   * the managed skills directory (created via createSkill), its folder is
   * deleted. External skills registered via registerSkill are only dereferenced.
   */
  async unregisterSkill(name: string): Promise<void> {
    const skill = this.findSkillByName(name);
    if (this.isManagedSkill(skill)) {
      await rm(skill.path, { recursive: true, force: true });
    }
    this.skills = this.skills.filter(s => s.name !== name);
    this.saveSkillsToConfig();
    this.apiSender.send('skill-manager-update');
  }

  listSkills(): SkillInfo[] {
    return this.skills;
  }

  /** Returns the raw SKILL.md file content for the given skill. */
  async getSkillContent(name: string): Promise<string> {
    const skill = this.findSkillByName(name);
    const filePath = join(skill.path, SKILL_FILE_NAME);
    return readFile(filePath, 'utf-8');
  }

  /** Lists all file/directory names inside the skill's folder. */
  async listSkillFolderContent(name: string): Promise<string[]> {
    const skill = this.findSkillByName(name);
    return readdir(skill.path);
  }

  private findSkillByName(name: string): SkillInfo {
    const skill = this.skills.find(s => s.name === name);
    if (!skill) {
      throw new Error(`Skill not found with name: ${name}`);
    }
    return skill;
  }

  private isManagedSkill(skill: SkillInfo): boolean {
    const skillsDir = this.directories.getSkillsDirectory();
    return skill.path.startsWith(skillsDir);
  }

  /**
   * Discovers skills from both the managed skills directory and
   * externally registered paths persisted in `skills.registered`.
   * Newly discovered skills are enabled by default.
   */
  async discoverSkills(): Promise<void> {
    const enabledNames = new Set<string>(this.configuration?.get<string[]>(SKILL_ENABLED) ?? []);
    const folderPaths: string[] = [...(this.configuration?.get<string[]>(SKILL_REGISTERED) ?? [])];

    const skillsDir = this.directories.getSkillsDirectory();
    if (existsSync(skillsDir)) {
      try {
        const entries = await readdir(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            folderPaths.push(join(skillsDir, entry.name));
          }
        }
      } catch {
        // ignore read errors on the managed directory
      }
    }

    const discovered: SkillInfo[] = [];

    for (const folderPath of folderPaths) {
      const skillFilePath = join(folderPath, SKILL_FILE_NAME);
      if (!existsSync(skillFilePath)) {
        continue;
      }

      try {
        const metadata = await this.parseSkillFile(skillFilePath);
        if (this.skills.some(s => s.name === metadata.name) || discovered.some(s => s.name === metadata.name)) {
          continue;
        }
        discovered.push({
          ...metadata,
          path: folderPath,
          enabled: enabledNames.has(metadata.name) || !enabledNames.size,
        });
      } catch (error: unknown) {
        console.warn(`[SkillManager] Skipping invalid skill at ${folderPath}: ${error}`);
      }
    }

    this.skills = [...this.skills, ...discovered];
    if (discovered.some(s => !enabledNames.has(s.name))) {
      this.saveSkillsToConfig();
    }
  }

  /** Persists enabled skill names and external skill path references to config. */
  private saveSkillsToConfig(): void {
    const enabledNames = this.skills.filter(s => s.enabled).map(s => s.name);
    this.configuration?.update(SKILL_ENABLED, enabledNames).catch(console.error);

    const registeredPaths = this.skills.filter(s => !this.isManagedSkill(s)).map(s => s.path);
    this.configuration?.update(SKILL_REGISTERED, registeredPaths).catch(console.error);
  }

  @preDestroy()
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
