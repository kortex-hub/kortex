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

import { beforeEach, describe, expect, test } from 'vitest';

import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';
import { ragEnvironments } from '/@/stores/rag-environments';
import { secretVaultInfos } from '/@/stores/secret-vault';
import { skillInfos } from '/@/stores/skills';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';
import type { RagEnvironment } from '/@api/rag/rag-environment';
import type { SecretVaultInfo } from '/@api/secret-vault/secret-vault-info';

import { resetDraft, wizard } from './agent-workspace-create-draft.svelte';

beforeEach(() => {
  skillInfos.set([]);
  mcpRemoteServerInfos.set([]);
  secretVaultInfos.set([]);
  ragEnvironments.set([]);
  resetDraft();
});

describe('wizard.draft initial state', () => {
  test('should start with step index 0', () => {
    expect(wizard.draft.currentStepIndex).toBe(0);
  });

  test('should start with empty form fields', () => {
    expect(wizard.draft.sourcePath).toBe('');
    expect(wizard.draft.sessionName).toBe('');
    expect(wizard.draft.description).toBe('');
  });

  test('should start with default agent opencode', () => {
    expect(wizard.draft.selectedAgent).toBe('opencode');
  });

  test('should start with no model selected', () => {
    expect(wizard.draft.selectedModel).toBeUndefined();
  });

  test('should start with workspace file access', () => {
    expect(wizard.draft.selectedFileAccess).toBe('workspace');
  });

  test('should start with registries network', () => {
    expect(wizard.draft.selectedNetwork).toBe('registries');
  });

  test('should start with empty selection arrays', () => {
    expect(wizard.draft.selectedSkillIds).toEqual([]);
    expect(wizard.draft.selectedMcpIds).toEqual([]);
    expect(wizard.draft.selectedSecretIds).toEqual([]);
    expect(wizard.draft.selectedKnowledgeIds).toEqual([]);
  });

  test('should start uninitialized', () => {
    expect(wizard.draft.initialized).toBe(false);
  });

  test('should start with default hostsByMode', () => {
    expect(wizard.draft.hostsByMode).toEqual({
      registries: ['registry.npmjs.org', 'pypi.python.org'],
      blocked: [''],
    });
  });
});

describe('resetDraft', () => {
  test('should reset all fields to defaults', () => {
    wizard.draft.currentStepIndex = 3;
    wizard.draft.sourcePath = '/some/path';
    wizard.draft.sessionName = 'my-session';
    wizard.draft.selectedAgent = 'claude';
    wizard.draft.initialized = true;
    wizard.draft.selectedSkillIds = ['skill-1', 'skill-2'];

    resetDraft();

    expect(wizard.draft.currentStepIndex).toBe(0);
    expect(wizard.draft.sourcePath).toBe('');
    expect(wizard.draft.sessionName).toBe('');
    expect(wizard.draft.selectedAgent).toBe('opencode');
    expect(wizard.draft.initialized).toBe(false);
    expect(wizard.draft.selectedSkillIds).toEqual([]);
  });
});

describe('state persistence', () => {
  test('should retain values between accesses', () => {
    wizard.draft.sourcePath = '/home/user/project';
    wizard.draft.currentStepIndex = 2;
    wizard.draft.selectedSkillIds = ['k8s', 'docker'];

    expect(wizard.draft.sourcePath).toBe('/home/user/project');
    expect(wizard.draft.currentStepIndex).toBe(2);
    expect(wizard.draft.selectedSkillIds).toEqual(['k8s', 'docker']);
  });
});

describe('resetDraft selects all available items', () => {
  test('should select all enabled skills', () => {
    skillInfos.set([
      { name: 'k8s', description: '', path: '', enabled: true, managed: false },
      { name: 'docker', description: '', path: '', enabled: true, managed: false },
    ]);
    resetDraft();

    expect(wizard.draft.selectedSkillIds).toEqual(['k8s', 'docker']);
  });

  test('should exclude disabled skills', () => {
    skillInfos.set([
      { name: 'k8s', description: '', path: '', enabled: true, managed: false },
      { name: 'docker', description: '', path: '', enabled: false, managed: false },
    ]);
    resetDraft();

    expect(wizard.draft.selectedSkillIds).toEqual(['k8s']);
  });

  test('should select all MCP servers', () => {
    mcpRemoteServerInfos.set([{ id: 'srv-1', name: 'Server 1' } as MCPRemoteServerInfo]);
    resetDraft();

    expect(wizard.draft.selectedMcpIds).toEqual(['srv-1']);
  });

  test('should not select any secrets', () => {
    secretVaultInfos.set([{ id: 'sec-1', name: 'Secret 1', type: 'api', description: '' } as SecretVaultInfo]);
    resetDraft();

    expect(wizard.draft.selectedSecretIds).toEqual([]);
  });

  test('should select knowledge bases with mcpServer only', () => {
    ragEnvironments.set([
      { name: 'with-mcp', mcpServer: { id: 'mcp-1' } } as unknown as RagEnvironment,
      { name: 'without-mcp', mcpServer: undefined } as unknown as RagEnvironment,
    ]);
    resetDraft();

    expect(wizard.draft.selectedKnowledgeIds).toEqual(['with-mcp']);
  });
});

describe('first emission seeding', () => {
  test('should seed selections from pre-populated stores on first emission after reset', () => {
    skillInfos.set([
      { name: 'k8s', description: '', path: '', enabled: true, managed: false },
      { name: 'docker', description: '', path: '', enabled: true, managed: false },
    ]);
    mcpRemoteServerInfos.set([{ id: 'srv-1', name: 'Server 1' } as MCPRemoteServerInfo]);
    secretVaultInfos.set([{ id: 'sec-1', name: 'Secret 1', type: 'api', description: '' } as SecretVaultInfo]);
    ragEnvironments.set([{ name: 'kb-1', mcpServer: { id: 'mcp-1' } } as unknown as RagEnvironment]);

    expect(wizard.draft.selectedSkillIds).toContain('k8s');
    expect(wizard.draft.selectedSkillIds).toContain('docker');
    expect(wizard.draft.selectedMcpIds).toContain('srv-1');
    expect(wizard.draft.selectedSecretIds).toEqual([]);
    expect(wizard.draft.selectedKnowledgeIds).toContain('kb-1');
  });
});

describe('selection syncing from subscriptions', () => {
  test('should remove skills no longer available', () => {
    skillInfos.set([
      { name: 'k8s', description: '', path: '', enabled: true, managed: false },
      { name: 'docker', description: '', path: '', enabled: true, managed: false },
    ]);
    resetDraft();

    skillInfos.set([{ name: 'k8s', description: '', path: '', enabled: true, managed: false }]);

    expect(wizard.draft.selectedSkillIds).toEqual(['k8s']);
  });

  test('should preserve user deselections when store re-emits', () => {
    skillInfos.set([
      { name: 'k8s', description: '', path: '', enabled: true, managed: false },
      { name: 'docker', description: '', path: '', enabled: true, managed: false },
    ]);
    resetDraft();

    wizard.draft.selectedSkillIds = ['k8s'];

    skillInfos.set([
      { name: 'k8s', description: '', path: '', enabled: true, managed: false },
      { name: 'docker', description: '', path: '', enabled: true, managed: false },
    ]);

    expect(wizard.draft.selectedSkillIds).toEqual(['k8s']);
  });

  test('should auto-select newly added items', () => {
    skillInfos.set([{ name: 'k8s', description: '', path: '', enabled: true, managed: false }]);
    resetDraft();

    skillInfos.set([
      { name: 'k8s', description: '', path: '', enabled: true, managed: false },
      { name: 'docker', description: '', path: '', enabled: true, managed: false },
    ]);

    expect(wizard.draft.selectedSkillIds).toEqual(['k8s', 'docker']);
  });

  test('should remove skill when it becomes disabled', () => {
    skillInfos.set([
      { name: 'k8s', description: '', path: '', enabled: true, managed: false },
      { name: 'docker', description: '', path: '', enabled: true, managed: false },
    ]);
    resetDraft();

    skillInfos.set([
      { name: 'k8s', description: '', path: '', enabled: true, managed: false },
      { name: 'docker', description: '', path: '', enabled: false, managed: false },
    ]);

    expect(wizard.draft.selectedSkillIds).toEqual(['k8s']);
  });
});
