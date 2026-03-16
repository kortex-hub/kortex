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
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { components } from '@kortex-hub/mcp-registry-types';
import { inject, injectable } from 'inversify';

import { MCPRegistry } from '/@/plugin/mcp/mcp-registry.js';
import { MCPPackage } from '/@/plugin/mcp/package/mcp-package.js';
import type { ResolvedServerPackage } from '/@/plugin/mcp/package/mcp-spawner.js';
import { isMac, isWindows } from '/@/util.js';
import type { MCPExportTarget } from '/@api/mcp/mcp-export.js';
import { CLAUDE_CODE, CLAUDE_DESKTOP, CURSOR, VSCODE } from '/@api/mcp/mcp-export.js';

type ServerPackage = components['schemas']['Package'];
type ServerRemote = components['schemas']['StreamableHttpTransport'] | components['schemas']['SseTransport'];

interface StdioEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface HttpEntry {
  type: 'http' | 'sse';
  url: string;
  headers?: Record<string, string>;
}

type MCPServerEntry = StdioEntry | (StdioEntry & { type: 'stdio' }) | HttpEntry;

@injectable()
export class MCPExporter {
  constructor(
    @inject(MCPRegistry)
    private readonly mcpRegistry: MCPRegistry,
  ) {}

  async exportServer(serverId: string, target: MCPExportTarget): Promise<void> {
    const configs = await this.mcpRegistry.getConfigurations();
    const config = configs.find(c => c.serverId === serverId);
    if (!config) {
      throw new Error(`No stored configuration found for server "${serverId}"`);
    }

    const serverDetails = await this.mcpRegistry.listMCPServersFromRegistries();
    const detail = serverDetails.find(s => s.serverId === serverId);
    if (!detail) {
      throw new Error(`Server detail not found for "${serverId}"`);
    }

    const serverName = detail.name;

    if ('remoteId' in config) {
      const remote = detail.remotes?.[config.remoteId];
      if (!remote) {
        throw new Error(`Remote entry at index ${String(config.remoteId)} not found for "${serverId}"`);
      }
      const entry = this.buildRemoteEntry(target, remote, config.headers);
      await this.writeEntry(target, serverName, entry);
    } else {
      const pack = detail.packages?.[config.packageId];
      if (!pack) {
        throw new Error(`Package entry at index ${String(config.packageId)} not found for "${serverId}"`);
      }
      const entry = this.buildPackageEntry(target, pack, config);
      await this.writeEntry(target, serverName, entry);
    }
  }

  buildPackageEntry(
    target: MCPExportTarget,
    pack: ServerPackage,
    config: { runtimeArguments?: string[]; packageArguments?: string[]; environmentVariables?: Record<string, string> },
  ): MCPServerEntry {
    const resolved: ResolvedServerPackage = {
      ...pack,
      runtimeArguments: config.runtimeArguments,
      packageArguments: config.packageArguments,
      environmentVariables: config.environmentVariables,
    };
    const spec = new MCPPackage(resolved).buildCommandSpec();
    const env = spec.env && Object.keys(spec.env).length > 0 ? spec.env : undefined;

    switch (target) {
      case CLAUDE_DESKTOP:
      case CURSOR:
        return { command: spec.command, args: spec.args, ...(env ? { env } : {}) };
      case CLAUDE_CODE:
      case VSCODE:
        return { type: 'stdio', command: spec.command, args: spec.args, ...(env ? { env } : {}) };
    }
  }

  buildRemoteEntry(target: MCPExportTarget, remote: ServerRemote, headers: Record<string, string>): MCPServerEntry {
    if (target === CLAUDE_CODE || target === VSCODE) {
      return {
        type: 'http',
        url: remote.url,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      };
    }

    // CLAUDE_DESKTOP and CURSOR: use mcp-remote proxy
    const args = ['mcp-remote', remote.url];
    const env: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      const envVarName = `MCP_HEADER_${key.toUpperCase().replace(/-/g, '_')}`;
      args.push('--header', `${key}:\${${envVarName}}`);
      env[envVarName] = value;
    }

    return {
      command: 'npx',
      args,
      ...(Object.keys(env).length > 0 ? { env } : {}),
    };
  }

  getConfigFilePath(target: MCPExportTarget): string {
    switch (target) {
      case CLAUDE_DESKTOP: {
        if (isWindows()) {
          return join(
            process.env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming'),
            'Claude',
            'claude_desktop_config.json',
          );
        }
        if (isMac()) {
          return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
        }
        return join(homedir(), '.config', 'Claude', 'claude_desktop_config.json');
      }
      case CLAUDE_CODE:
        return join(homedir(), '.claude.json');
      case CURSOR:
        return join(homedir(), '.cursor', 'mcp.json');
      case VSCODE:
        return join(homedir(), '.vscode', 'mcp.json');
    }
  }

  async writeEntry(target: MCPExportTarget, serverName: string, entry: MCPServerEntry): Promise<void> {
    const filePath = this.getConfigFilePath(target);
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    let existing: Record<string, unknown> = {};
    if (existsSync(filePath)) {
      try {
        const raw = await readFile(filePath, 'utf-8');
        existing = JSON.parse(raw);
      } catch {
        existing = {};
      }
    }

    const serversKey = target === VSCODE ? 'servers' : 'mcpServers';

    if (!existing[serversKey] || typeof existing[serversKey] !== 'object') {
      existing[serversKey] = {};
    }

    (existing[serversKey] as Record<string, unknown>)[serverName] = entry;

    await writeFile(filePath, JSON.stringify(existing, undefined, 2), 'utf-8');
  }
}
