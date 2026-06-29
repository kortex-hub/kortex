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

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { AgentRegistry } from '/@/plugin/agent-registry.js';
import type { OpenshellCli } from '/@/plugin/openshell-cli/openshell-cli.js';
import type { AcpSessionCreateOptions } from '/@api/acp-session-info.js';
import type { AgentInfo } from '/@api/agent-info.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { SandboxInfo } from '/@api/openshell-gateway-info.js';

import { AcpSessionManager } from './acp-session-manager.js';

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn(),
};

const openshellCli: OpenshellCli = {
  getCliPath: vi.fn().mockReturnValue('/usr/bin/openshell'),
  listSandboxes: vi.fn(),
} as unknown as OpenshellCli;

const agentRegistry: AgentRegistry = {
  getAgent: vi.fn(),
} as unknown as AgentRegistry;

function createSandbox(overrides?: Partial<SandboxInfo>): SandboxInfo {
  return {
    id: 'sandbox-1',
    name: 'test-sandbox',
    phase: 'Ready',
    ...overrides,
  };
}

function createAgentInfo(overrides?: Partial<AgentInfo>): AgentInfo {
  return {
    id: 'openclaw',
    name: 'OpenClaw',
    description: 'Test agent',
    command: 'openclaw',
    acp: { args: ['acp'] },
    ...overrides,
  };
}

describe('AcpSessionManager', () => {
  let manager: AcpSessionManager;

  beforeEach(() => {
    vi.resetAllMocks();
    manager = new AcpSessionManager(apiSender, openshellCli, agentRegistry);
  });

  describe('resolveAgentCommand', () => {
    test('resolves agent from options.agentId', async () => {
      const agent = createAgentInfo();
      vi.mocked(agentRegistry.getAgent).mockResolvedValue(agent);

      const options: AcpSessionCreateOptions = { sandboxName: 'sb', prompt: 'hello', agentId: 'openclaw' };
      const sandbox = createSandbox();

      const result = await manager.resolveAgentCommand(options, sandbox);

      expect(agentRegistry.getAgent).toHaveBeenCalledWith('openclaw');
      expect(result.agentInfo).toBe(agent);
      expect(result.command).toEqual(['openclaw', 'acp']);
    });

    test('resolves agent from sandbox kaiden.agent label', async () => {
      const agent = createAgentInfo({ id: 'copilot', command: 'copilot', acp: { args: ['--acp'] } });
      vi.mocked(agentRegistry.getAgent).mockResolvedValue(agent);

      const options: AcpSessionCreateOptions = { sandboxName: 'sb', prompt: 'hello' };
      const sandbox = createSandbox({ labels: { 'kaiden.agent': 'copilot' } });

      const result = await manager.resolveAgentCommand(options, sandbox);

      expect(agentRegistry.getAgent).toHaveBeenCalledWith('copilot');
      expect(result.command).toEqual(['copilot', '--acp']);
    });

    test('options.agentId takes priority over sandbox label', async () => {
      const agent = createAgentInfo({ id: 'openclaw', command: 'openclaw' });
      vi.mocked(agentRegistry.getAgent).mockResolvedValue(agent);

      const options: AcpSessionCreateOptions = { sandboxName: 'sb', prompt: 'hello', agentId: 'openclaw' };
      const sandbox = createSandbox({ labels: { 'kaiden.agent': 'copilot' } });

      const result = await manager.resolveAgentCommand(options, sandbox);

      expect(agentRegistry.getAgent).toHaveBeenCalledWith('openclaw');
      expect(result.agentInfo.id).toBe('openclaw');
    });

    test('throws when no agent specified and no sandbox label', async () => {
      const options: AcpSessionCreateOptions = { sandboxName: 'sb', prompt: 'hello' };
      const sandbox = createSandbox();

      await expect(manager.resolveAgentCommand(options, sandbox)).rejects.toThrow('No agent specified');
    });

    test('throws when agent not found in registry', async () => {
      vi.mocked(agentRegistry.getAgent).mockResolvedValue(undefined);

      const options: AcpSessionCreateOptions = { sandboxName: 'sb', prompt: 'hello', agentId: 'unknown' };
      const sandbox = createSandbox();

      await expect(manager.resolveAgentCommand(options, sandbox)).rejects.toThrow('Agent "unknown" not found');
    });

    test('throws when agent does not support ACP', async () => {
      const agent = createAgentInfo({ id: 'claude', name: 'Claude Code', acp: undefined });
      vi.mocked(agentRegistry.getAgent).mockResolvedValue(agent);

      const options: AcpSessionCreateOptions = { sandboxName: 'sb', prompt: 'hello', agentId: 'claude' };
      const sandbox = createSandbox();

      await expect(manager.resolveAgentCommand(options, sandbox)).rejects.toThrow(
        'Agent "Claude Code" does not support ACP',
      );
    });
  });
});
