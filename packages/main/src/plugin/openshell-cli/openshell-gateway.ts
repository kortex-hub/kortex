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

import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Disposable } from '@openkaiden/api';
import { inject, injectable, preDestroy } from 'inversify';
import Mustache from 'mustache';

import { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import { Directories } from '/@/plugin/directories.js';
import { OpenshellCli } from '/@/plugin/openshell-cli/openshell-cli.js';
import { Exec } from '/@/plugin/util/exec.js';
import type { OpenshellGatewayStartOptions } from '/@api/openshell-gateway-info.js';

import gatewayConfigTemplate from './openshell-gateway.toml.template?raw';

const DEFAULT_PORT = 17670;
const DEFAULT_BIND_ADDRESS = '127.0.0.1';
const HEALTH_CHECK_INTERVAL_MS = 1000;
const MAX_HEALTH_CHECK_ATTEMPTS = 30;
const STOP_TIMEOUT_MS = 5000;
const SUPERVISOR_IMAGE_BASE = 'ghcr.io/nvidia/openshell/supervisor';

/**
 * Manages the `openshell-gateway` server binary lifecycle.
 *
 * On {@link init}, discovers existing gateways via the CLI. If a healthy
 * gateway is found it is selected. Otherwise, auto-starts a new local
 * gateway by spawning the `openshell-gateway` binary, waiting for it to
 * become healthy, and registering it with the CLI.
 */
@injectable()
export class OpenshellGateway implements Disposable {
  #gatewayProcess: ChildProcess | undefined;
  #port: number = DEFAULT_PORT;
  #bindAddress: string = DEFAULT_BIND_ADDRESS;

  constructor(
    @inject(CliToolRegistry)
    private readonly cliToolRegistry: CliToolRegistry,
    @inject(OpenshellCli)
    private readonly openshellCli: OpenshellCli,
    @inject(Directories)
    private readonly directories: Directories,
    @inject(Exec)
    private readonly exec: Exec,
  ) {}

  async init(): Promise<void> {
    try {
      const gateways = await this.openshellCli.listGateways();
      const localGateways = gateways.filter(gw => gw.type === 'local' || this.isLocalEndpoint(gw.endpoint));
      if (localGateways.length > 0) {
        for (const gw of localGateways) {
          if (await this.isEndpointHealthy(gw.endpoint)) {
            if (!gw.active) {
              await this.openshellCli.selectGateway(gw.name);
            }
            console.log(`[openshell-gateway] gateway detected (${gw.endpoint}) and is healthy`);
            return;
          }
        }
        console.warn('[openshell-gateway] local gateway(s) defined but none reachable');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[openshell-gateway] failed to discover gateways: ${message}`);
    }

    const binaryPath = this.getGatewayBinaryPath();
    if (!binaryPath) {
      console.warn('[openshell-gateway] no existing gateways and binary not registered, skipping auto-start');
      return;
    }

    if (await this.isEndpointHealthy()) {
      console.log('[openshell-gateway] found healthy gateway on default port, registering');
      await this.registerWithCli();
      return;
    }

    console.log('[openshell-gateway] no existing gateways found, auto-starting local gateway');
    await this.start();
  }

  private async isEndpointHealthy(endpoint?: string): Promise<boolean> {
    const target = endpoint ?? `http://${this.#bindAddress}:${this.#port}`;
    return this.openshellCli.checkEndpointStatus(target);
  }

  private isLocalEndpoint(endpoint: string): boolean {
    try {
      const url = new URL(endpoint);
      return ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
    } catch {
      return false;
    }
  }

  getGatewayBinaryPath(): string | undefined {
    const tool = this.cliToolRegistry.getCliToolInfos().find(t => t.name === 'openshell-gateway');
    return tool?.path;
  }

  async start(options?: OpenshellGatewayStartOptions): Promise<void> {
    if (this.#gatewayProcess) {
      console.log('[openshell-gateway] already running, skipping start');
      return;
    }

    const binaryPath = this.getGatewayBinaryPath();
    if (!binaryPath) {
      throw new Error('openshell-gateway binary not registered in CLI tool registry');
    }

    const previousPort = this.#port;
    const previousBindAddress = this.#bindAddress;

    if (options?.port !== undefined) {
      this.#port = options.port;
    }
    if (options?.bindAddress !== undefined) {
      this.#bindAddress = options.bindAddress;
    }

    const configPath = await this.createGatewayConfig(binaryPath, options?.supervisorImage);
    const args = this.buildArgs(options?.disableTls ?? true, configPath);
    console.log(`[openshell-gateway] starting: ${binaryPath} ${args.join(' ')}`);

    this.#gatewayProcess = spawn(binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    this.#gatewayProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[openshell-gateway] ${data.toString().trimEnd()}`);
    });

    this.#gatewayProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[openshell-gateway] ${data.toString().trimEnd()}`);
    });

    this.#gatewayProcess.on('exit', (code, signal) => {
      console.log(`[openshell-gateway] exited with code=${code ?? 'none'} signal=${signal ?? 'none'}`);
      this.#gatewayProcess = undefined;
    });

    this.#gatewayProcess.on('error', (err: Error) => {
      console.error(`[openshell-gateway] failed to start: ${err.message}`);
      this.#gatewayProcess = undefined;
    });

    try {
      await this.waitForReady();
    } catch (err: unknown) {
      await this.stop().catch((stopErr: unknown) => {
        console.warn('[openshell-gateway] failed to stop after startup error:', stopErr);
      });
      this.#port = previousPort;
      this.#bindAddress = previousBindAddress;
      throw err;
    }
    if (!options?.skipRegistration) {
      await this.registerWithCli();
    }
  }

  async stop(): Promise<void> {
    const proc = this.#gatewayProcess;
    if (!proc) {
      return;
    }

    console.log('[openshell-gateway] stopping');
    proc.kill('SIGTERM');

    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        if (typeof proc.exitCode !== 'number') {
          console.warn('[openshell-gateway] did not exit after SIGTERM, sending SIGKILL');
          proc.kill('SIGKILL');
        }
        resolve();
      }, STOP_TIMEOUT_MS);

      proc.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.#gatewayProcess = undefined;
  }

  isRunning(): boolean {
    return this.#gatewayProcess !== undefined && typeof this.#gatewayProcess.exitCode !== 'number';
  }

  @preDestroy()
  dispose(): void {
    this.stop().catch((err: unknown) => console.error('[openshell-gateway] failed to stop: ', err));
  }

  private async generateCerts(binaryPath: string, gatewayDir: string): Promise<void> {
    await this.exec.exec(binaryPath, [
      'generate-certs',
      '--server-san',
      '127.0.0.1',
      '--server-san',
      'localhost',
      '--server-san',
      'host.openshell.internal',
      '--output-dir',
      gatewayDir,
    ]);
  }

  private buildArgs(disableTls: boolean, configPath?: string): string[] {
    const args: string[] = [];
    if (configPath) {
      args.push('--config', configPath);
    }
    args.push('--port', String(this.#port));
    args.push('--bind-address', this.#bindAddress);
    if (disableTls) {
      args.push('--disable-tls');
    }
    return args;
  }

  private async getGatewayVersion(binaryPath: string): Promise<string> {
    const result = await this.exec.exec(binaryPath, ['--version']);
    const output = result.stdout.trim();
    const token = output.split(' ').pop() ?? '';
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some(p => p.length === 0 || !Number.isFinite(Number(p)))) {
      throw new Error(`Unable to parse version from: ${output}`);
    }
    return token;
  }

  private async createGatewayConfig(binaryPath: string, supervisorImage?: string): Promise<string | undefined> {
    try {
      let image = supervisorImage;
      if (!image) {
        try {
          const version = await this.getGatewayVersion(binaryPath);
          image = `${SUPERVISOR_IMAGE_BASE}:${version}`;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[openshell-gateway] unable to detect version for supervisor pinning: ${message}`);
        }
      }

      const storageDirectory = join(this.directories.getDataDirectory(), 'openshell-gateway');
      const configPath = join(storageDirectory, 'gateway.toml');
      await this.generateCerts(binaryPath, storageDirectory);
      const config = Mustache.render(gatewayConfigTemplate, {
        supervisorImage: image,
        gatewayDir: storageDirectory,
        q: '"',
      });

      await mkdir(storageDirectory, { recursive: true });
      await writeFile(configPath, config, 'utf-8');
      if (image) {
        console.log(`[openshell-gateway] supervisor image pinned to ${image}`);
      }
      console.log(`[openshell-gateway] generated local gateway config at ${configPath}`);
      return configPath;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[openshell-gateway] failed to generate gateway config: ${message}`);
      return undefined;
    }
  }

  private async waitForReady(): Promise<void> {
    const endpoint = `http://${this.#bindAddress}:${this.#port}`;
    console.log(`[openshell-gateway] waiting for server at ${endpoint}`);

    for (let attempt = 0; attempt < MAX_HEALTH_CHECK_ATTEMPTS; attempt++) {
      if (!this.isRunning()) {
        throw new Error('Gateway process exited before becoming ready');
      }

      if (await this.openshellCli.checkEndpointStatus(endpoint)) {
        console.log('[openshell-gateway] server is ready');
        return;
      }

      await new Promise<void>(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS));
    }

    throw new Error(`Gateway did not become ready within ${MAX_HEALTH_CHECK_ATTEMPTS}s`);
  }

  private async registerWithCli(): Promise<void> {
    const endpoint = `http://${this.#bindAddress}:${this.#port}`;
    try {
      await this.openshellCli.addGateway({ endpoint, local: true, name: 'kaiden-local' });
      console.log(`[openshell-gateway] registered with CLI as kaiden-local at ${endpoint}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[openshell-gateway] failed to register with CLI: ${message}`);
    }
  }
}
