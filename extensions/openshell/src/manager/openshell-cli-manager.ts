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
import { join } from 'node:path';

import type { CliToolInstallationSource, Disposable, ExtensionContext } from '@openkaiden/api';
import * as extensionApi from '@openkaiden/api';
import { inject, injectable } from 'inversify';

import { ExtensionContextSymbol } from '/@/inject/symbol';

@injectable()
export class OpenshellCliManager implements Disposable {
  @inject(ExtensionContextSymbol)
  private extensionContext!: ExtensionContext;

  async init(): Promise<void> {
    const binDir = join(this.extensionContext.storagePath, 'bin');
    const binaryName = 'openshell';
    const localBinaryPath = join(binDir, binaryName);

    let binaryPath: string | undefined;
    let version: string | undefined;
    let installationSource: CliToolInstallationSource = 'external';

    const customPath = this.getCustomBinaryPath();
    if (customPath && existsSync(customPath)) {
      version = await this.getVersion(customPath);
      if (version) {
        binaryPath = customPath;
        installationSource = 'external';
        console.log(`[openshell] using custom binary path: ${customPath}`);
      } else {
        console.warn(`[openshell] custom binary at ${customPath} failed to report a version`);
      }
    }

    if (!binaryPath && existsSync(localBinaryPath)) {
      version = await this.getVersion(localBinaryPath);
      if (version) {
        binaryPath = localBinaryPath;
        installationSource = 'extension';
        console.log('[openshell] binary found in extension storage');
      } else {
        console.warn(`[openshell] binary exists at ${localBinaryPath} but failed to report a version`);
      }
    }

    if (!binaryPath) {
      const systemResult = await this.findOnPath();
      if (systemResult) {
        binaryPath = systemResult.path;
        version = systemResult.version;
        installationSource = 'external';
        console.log('[openshell] binary found in system PATH');
      } else {
        console.warn('[openshell] not found in system PATH');
      }
    }

    if (!binaryPath) {
      console.warn('[openshell] CLI not found, skipping registration');
      return;
    }

    const cliTool = extensionApi.cli.createCliTool({
      name: 'openshell',
      displayName: 'OpenShell',
      markdownDescription: 'OpenShell CLI for managing sandboxed workspaces',
      images: {},
      version,
      path: binaryPath,
      installationSource,
    });
    this.extensionContext.subscriptions.push(cliTool);
  }

  dispose(): void {}

  private getCustomBinaryPath(): string | undefined {
    return extensionApi.configuration.getConfiguration('openshell').get<string>('binary.path') ?? undefined;
  }

  private parseVersion(output: string): string | undefined {
    const firstLine = output.trim().split(/\r?\n/, 1)[0] ?? '';
    const parts = firstLine.trim().split(/\s+/);
    return parts[parts.length - 1] || undefined;
  }

  private async getVersion(binaryPath: string): Promise<string | undefined> {
    try {
      const result = await extensionApi.process.exec(binaryPath, ['--version']);
      return this.parseVersion(result.stdout || result.stderr);
    } catch {
      return undefined;
    }
  }

  private async findOnPath(): Promise<{ version: string; path: string } | undefined> {
    try {
      const result = await extensionApi.process.exec('openshell', ['--version']);
      const version = this.parseVersion(result.stdout || result.stderr);
      if (version) {
        const resolvedPath = await this.resolveFromPath();
        return { version, path: resolvedPath };
      }
    } catch {
      // not on PATH
    }
    return undefined;
  }

  private async resolveFromPath(): Promise<string> {
    const cmd = extensionApi.env.isWindows ? 'where' : 'which';
    const result = await extensionApi.process.exec(cmd, ['openshell']);
    return result.stdout.trim().split(/\r?\n/)[0];
  }
}
