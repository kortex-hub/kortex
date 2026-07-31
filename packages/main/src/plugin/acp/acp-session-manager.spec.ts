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

import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { AgentRegistry } from '/@/plugin/agent-registry.js';
import type { OpenshellCli } from '/@/plugin/openshell-cli/openshell-cli.js';
import type { AcpSessionCreateOptions } from '/@api/acp-session-info.js';
import type { AgentInfo } from '/@api/agent-info.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import { AGENT_LABEL, type SandboxInfo } from '/@api/openshell-gateway-info.js';

import { AcpSessionManager } from './acp-session-manager.js';

vi.mock(import('node:fs/promises'));

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn(),
};

const openshellCli: OpenshellCli = {
  getCliPath: vi.fn().mockReturnValue('/usr/bin/openshell'),
  listSandboxes: vi.fn(),
  uploadToSandbox: vi.fn(),
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
    destinationSkillsFolder: '/skills',
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
      const sandbox = createSandbox({ labels: { [AGENT_LABEL]: 'copilot' } });

      const result = await manager.resolveAgentCommand(options, sandbox);

      expect(agentRegistry.getAgent).toHaveBeenCalledWith('copilot');
      expect(result.command).toEqual(['copilot', '--acp']);
    });

    test('uses acp.command override when provided', async () => {
      const agent = createAgentInfo({
        id: 'claude',
        command: 'claude',
        acp: { command: 'claude-agent-acp', args: [] },
      });
      vi.mocked(agentRegistry.getAgent).mockResolvedValue(agent);

      const options: AcpSessionCreateOptions = { sandboxName: 'sb', prompt: 'hello', agentId: 'claude' };
      const sandbox = createSandbox();

      const result = await manager.resolveAgentCommand(options, sandbox);

      expect(result.command).toEqual(['claude-agent-acp']);
    });

    test('options.agentId takes priority over sandbox label', async () => {
      const agent = createAgentInfo({ id: 'openclaw', command: 'openclaw' });
      vi.mocked(agentRegistry.getAgent).mockResolvedValue(agent);

      const options: AcpSessionCreateOptions = { sandboxName: 'sb', prompt: 'hello', agentId: 'openclaw' };
      const sandbox = createSandbox({ labels: { [AGENT_LABEL]: 'copilot' } });

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

  describe('uploadAttachments', () => {
    test('uploads image attachments to sandbox and returns remote path', async () => {
      vi.mocked(openshellCli.uploadToSandbox).mockResolvedValue();

      const attachments = [{ filePath: '/local/photo.png', fileName: 'photo.png', mimeType: 'image/png' }];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (manager as any).uploadAttachments('test-sandbox', attachments);

      expect(openshellCli.uploadToSandbox).toHaveBeenCalledWith(
        'test-sandbox',
        '/local/photo.png',
        expect.stringContaining('/tmp/kaiden-attachments/'),
        undefined,
      );
      expect(result).toHaveLength(1);
      expect(result[0].isText).toBe(false);
      expect(result[0].remotePath).toMatch(/\/tmp\/kaiden-attachments\/.*\/photo\.png/);
    });

    test('reads text attachments inline without uploading', async () => {
      vi.mocked(readFile).mockResolvedValue('hello world');

      const attachments = [{ filePath: '/local/notes.txt', fileName: 'notes.txt', mimeType: 'text/plain' }];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (manager as any).uploadAttachments('test-sandbox', attachments);

      expect(openshellCli.uploadToSandbox).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].isText).toBe(true);
      expect(result[0].textContent).toBe('hello world');
    });

    test('uploads PDF attachments to sandbox', async () => {
      vi.mocked(openshellCli.uploadToSandbox).mockResolvedValue();

      const attachments = [{ filePath: '/local/doc.pdf', fileName: 'doc.pdf', mimeType: 'application/pdf' }];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (manager as any).uploadAttachments('test-sandbox', attachments);

      expect(openshellCli.uploadToSandbox).toHaveBeenCalled();
      expect(result[0].isText).toBe(false);
      expect(result[0].remotePath).toMatch(/\/tmp\/kaiden-attachments\/.*\/doc\.pdf/);
    });

    test('returns undefined when no attachments', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (manager as any).uploadAttachments('test-sandbox', undefined);
      expect(result).toBeUndefined();
    });

    test('passes gateway name to uploadToSandbox when provided', async () => {
      vi.mocked(openshellCli.uploadToSandbox).mockResolvedValue();

      const attachments = [{ filePath: '/local/photo.png', fileName: 'photo.png', mimeType: 'image/png' }];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (manager as any).uploadAttachments('test-sandbox', attachments, 'my-gateway');

      expect(openshellCli.uploadToSandbox).toHaveBeenCalledWith(
        'test-sandbox',
        '/local/photo.png',
        expect.stringContaining('/tmp/kaiden-attachments/'),
        'my-gateway',
      );
    });
  });

  describe('buildContentBlocks', () => {
    test('creates resource_link for uploaded non-text files', () => {
      const attachments = [
        {
          filePath: '/local/photo.png',
          fileName: 'photo.png',
          mimeType: 'image/png',
          isText: false,
          remotePath: '/tmp/kaiden-attachments/uuid-123/photo.png',
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blocks = (manager as any).buildContentBlocks('describe this', attachments);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({
        type: 'resource_link',
        uri: 'file:///tmp/kaiden-attachments/uuid-123/photo.png',
        name: 'photo.png',
        mimeType: 'image/png',
      });
      expect(blocks[1]).toEqual({ type: 'text', text: 'describe this' });
    });

    test('creates resource with inline text for text files', () => {
      const attachments = [
        {
          filePath: '/local/notes.txt',
          fileName: 'notes.txt',
          mimeType: 'text/plain',
          isText: true,
          textContent: 'hello world',
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blocks = (manager as any).buildContentBlocks('summarize this', attachments);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({
        type: 'resource',
        resource: {
          uri: 'file:///local/notes.txt',
          text: 'hello world',
          mimeType: 'text/plain',
        },
      });
      expect(blocks[1]).toEqual({ type: 'text', text: 'summarize this' });
    });

    test('creates only text block when no attachments', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blocks = (manager as any).buildContentBlocks('hello', undefined);

      expect(blocks).toEqual([{ type: 'text', text: 'hello' }]);
    });
  });
});
