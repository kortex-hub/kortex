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

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { CliToolInstallationSource, Disposable, ExtensionContext } from '@openkaiden/api';
import * as extensionApi from '@openkaiden/api';
import { inject, injectable } from 'inversify';

import { ExtensionContextSymbol } from '/@/inject/symbol';
import { OpenshellImageBuilderInstaller } from '/@/openshell-image-builder-installer';
import { OpenshellInstaller } from '/@/openshell-installer';

interface BinaryDiscoveryResult {
  path?: string;
  version?: string;
  installationSource: CliToolInstallationSource;
}

@injectable()
export class OpenshellCliManager implements Disposable {
  @inject(ExtensionContextSymbol)
  private extensionContext!: ExtensionContext;

  #registeredPath: string | undefined;

  getRegisteredPath(): string | undefined {
    return this.#registeredPath;
  }

  async init(): Promise<void> {
    const packageJsonPath = join(this.extensionContext.extensionUri.fsPath, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    const cliResult = await this.discoverBinary('openshell', 'binary.path', 'openshell');
    const registration: BinaryDiscoveryResult = cliResult ?? {
      installationSource: 'extension',
    };

    if (cliResult?.path) {
      this.#registeredPath = cliResult.path;
    } else {
      console.warn('[openshell] CLI not found, registering installer-only entry');
    }

    const cliTool = this.registerCliTool(
      'openshell',
      'OpenShell',
      'OpenShell CLI for managing sandboxed workspaces',
      registration,
    );
    const installer = new OpenshellInstaller(cliTool, packageJson.openshellVersion, this.extensionContext.storagePath);

    this.extensionContext.subscriptions.push(cliTool.registerInstaller(installer));

    const ibResult = await this.discoverBinary(
      'openshell-image-builder',
      'imageBuilder.binary.path',
      'openshell-image-builder',
      'image-builder',
    );
    const ibRegistration: BinaryDiscoveryResult = ibResult ?? {
      installationSource: 'extension',
    };

    if (!ibResult) {
      console.warn('[openshell-image-builder] CLI not found, registering installer-only entry');
    }

    const ibCliTool = this.registerCliTool(
      'openshell-image-builder',
      'OpenShell Image Builder',
      'CLI for building custom container images for OpenShell sandboxes',
      ibRegistration,
    );
    const ibInstaller = new OpenshellImageBuilderInstaller(
      ibCliTool,
      packageJson.openshellImageBuilderVersion,
      this.extensionContext.storagePath,
    );

    this.extensionContext.subscriptions.push(ibCliTool.registerInstaller(ibInstaller));

    const gwResult = await this.discoverBinary('openshell-gateway', 'gateway.binary.path', 'openshell');
    const gwRegistration: BinaryDiscoveryResult = gwResult ?? {
      installationSource: 'extension',
    };

    if (!gwResult) {
      console.warn('[openshell-gateway] CLI not found, registering installer-only entry');
    }

    this.registerCliTool(
      'openshell-gateway',
      'OpenShell Gateway',
      'OpenShell Gateway server for managing sandbox connections',
      gwRegistration,
    );
  }

  dispose(): void {}

  private registerCliTool(
    name: string,
    displayName: string,
    markdownDescription: string,
    result: BinaryDiscoveryResult,
  ): extensionApi.CliTool {
    const cliTool = extensionApi.cli.createCliTool({
      name,
      displayName,
      markdownDescription,
      images: {},
      version: result.version,
      path: result.path,
      installationSource: result.installationSource,
    });
    this.extensionContext.subscriptions.push(cliTool);
    console.log(`[${name}] registered at ${result.path} (v${result.version})`);
    return cliTool;
  }

  private async discoverBinary(
    binaryBaseName: string,
    configKey: string,
    resourceSubdir: string,
    assetsSubdir?: string,
  ): Promise<BinaryDiscoveryResult | undefined> {
    const binDir = join(this.extensionContext.storagePath, 'bin');
    const binaryName = extensionApi.env.isWindows ? `${binaryBaseName}.exe` : binaryBaseName;
    const localBinaryPath = join(binDir, binaryName);

    const resolutionOrder =
      extensionApi.configuration.getConfiguration('openshell').get<string>('binary.resolution') ??
      'bundled,storage,system';
    const sources = resolutionOrder.split(',');
    console.log(`[${binaryBaseName}] discovery order: custom config → ${sources.join(' → ')}`);

    const customPath = extensionApi.configuration.getConfiguration('openshell').get<string>(configKey) ?? undefined;
    if (customPath && existsSync(customPath)) {
      const version = await this.getVersion(customPath);
      if (version) {
        console.log(`[${binaryBaseName}] using custom binary path: ${customPath}`);
        return { path: customPath, version, installationSource: 'external' };
      }
      console.warn(`[${binaryBaseName}] custom binary at ${customPath} failed to report a version`);
    }

    for (const source of sources) {
      let result: BinaryDiscoveryResult | undefined;
      switch (source) {
        case 'storage':
          result = await this.discoverFromExtensionStorage(binaryBaseName, localBinaryPath);
          break;
        case 'bundled':
          result = await this.discoverFromBundledResources(binaryBaseName, binaryName, resourceSubdir, assetsSubdir);
          break;
        case 'system':
          result = await this.discoverFromSystemPath(binaryBaseName);
          break;
      }
      if (result) return result;
    }

    return undefined;
  }

  private async discoverFromExtensionStorage(
    binaryBaseName: string,
    localBinaryPath: string,
  ): Promise<BinaryDiscoveryResult | undefined> {
    if (existsSync(localBinaryPath)) {
      const version = await this.getVersion(localBinaryPath);
      if (version) {
        console.log(`[${binaryBaseName}] binary found in extension storage`);
        return { path: localBinaryPath, version, installationSource: 'extension' };
      }
      console.warn(`[${binaryBaseName}] binary exists at ${localBinaryPath} but failed to report a version`);
    }
    return undefined;
  }

  private async discoverFromBundledResources(
    binaryBaseName: string,
    binaryName: string,
    resourceSubdir: string,
    assetsSubdir?: string,
  ): Promise<BinaryDiscoveryResult | undefined> {
    let resourcesPath: string | undefined;
    let bundledResourceSubdir: string;
    if (import.meta.env.PROD) {
      resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
      bundledResourceSubdir = resourceSubdir;
    } else {
      // In development mode, use the path used by download scripts in assets folder
      const parts: string[] = [this.extensionContext.extensionUri.fsPath, 'assets'];
      if (assetsSubdir) {
        parts.push(assetsSubdir);
      }
      resourcesPath = join(...parts);
      bundledResourceSubdir = `${process.platform}-${process.arch}`;
    }
    if (resourcesPath) {
      const bundledBinaryPath = join(resourcesPath, bundledResourceSubdir, binaryName);
      console.log(`[${binaryBaseName}] checking bundled resources at ${bundledBinaryPath}`);
      if (existsSync(bundledBinaryPath)) {
        const version = await this.getVersion(bundledBinaryPath);
        if (version) {
          console.log(`[${binaryBaseName}] binary found in bundled resources at ${bundledBinaryPath}`);
          return { path: bundledBinaryPath, version, installationSource: 'extension' };
        }
        console.warn(`[${binaryBaseName}] bundled binary at ${bundledBinaryPath} failed to report a version`);
      }
    } else {
      console.log(`[${binaryBaseName}] no resourcesPath set, skipping bundled resources check`);
    }
    return undefined;
  }

  private async discoverFromSystemPath(binaryBaseName: string): Promise<BinaryDiscoveryResult | undefined> {
    const systemResult = await this.findOnPath(binaryBaseName);
    if (systemResult) {
      console.log(`[${binaryBaseName}] binary found in system PATH at ${systemResult.path}`);
      return { path: systemResult.path, version: systemResult.version, installationSource: 'external' };
    }
    return undefined;
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

  private async findOnPath(binaryName: string): Promise<{ version: string; path: string } | undefined> {
    try {
      const result = await extensionApi.process.exec(binaryName, ['--version']);
      const version = this.parseVersion(result.stdout || result.stderr);
      if (version) {
        const resolvedPath = await this.resolveFromPath(binaryName);
        return { version, path: resolvedPath };
      }
    } catch {
      // not on PATH
    }
    return undefined;
  }

  private async resolveFromPath(binaryName: string): Promise<string> {
    const cmd = extensionApi.env.isWindows ? 'where' : 'which';
    const result = await extensionApi.process.exec(cmd, [binaryName]);
    return result.stdout.trim().split(/\r?\n/)[0];
  }
}
