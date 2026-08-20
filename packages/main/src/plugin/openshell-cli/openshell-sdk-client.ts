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
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { ConnectOptions, OpenShellClient } from '@nvidia/openshell-sdk';
import { inject, injectable, preDestroy } from 'inversify';

import { OpenshellCli } from '/@/plugin/openshell-cli/openshell-cli.js';
import type { GatewayInfo } from '/@api/openshell-gateway-info.js';

/**
 * Resolve the OpenShell config root following the same logic as the Rust CLI:
 *   1. $XDG_CONFIG_HOME (all platforms, including Windows)
 *   2. %APPDATA% on win32
 *   3. $HOME/.config
 */
function openshellConfigRoot(): string {
  const xdg = process.env['XDG_CONFIG_HOME'];
  if (xdg) return xdg;

  if (process.platform === 'win32') {
    const appdata = process.env['APPDATA'];
    if (appdata) return appdata;
  }

  return join(homedir(), '.config');
}

function gatewayMtlsDir(gatewayName: string): string {
  return join(openshellConfigRoot(), 'openshell', 'gateways', gatewayName, 'mtls');
}

async function readCertIfExists(filePath: string): Promise<Buffer | undefined> {
  try {
    return await readFile(filePath);
  } catch {
    return undefined;
  }
}

async function buildConnectOptions(gateway: GatewayInfo): Promise<ConnectOptions> {
  const isHttps = gateway.endpoint.startsWith('https://');

  if (!isHttps) {
    return { gateway: gateway.endpoint };
  }

  const mtlsDir = gatewayMtlsDir(gateway.name);
  const [caCert, clientCert, clientKey] = await Promise.all([
    readCertIfExists(join(mtlsDir, 'ca.crt')),
    readCertIfExists(join(mtlsDir, 'tls.crt')),
    readCertIfExists(join(mtlsDir, 'tls.key')),
  ]);

  return {
    gateway: gateway.endpoint,
    caCert,
    clientCert,
    clientKey,
  };
}

/**
 * Cached factory for OpenShell SDK clients. Resolves gateway metadata from
 * the CLI (`openshell gateway list`) and builds `ConnectOptions` with the
 * appropriate auth (plaintext for http://, mTLS certs for https://).
 *
 * Clients are lazy — no network request is made until the first RPC.
 */
@injectable()
export class OpenshellSdkClient {
  readonly #cache = new Map<string, OpenShellClient>();

  constructor(
    @inject(OpenshellCli)
    private readonly openshellCli: OpenshellCli,
  ) {}

  async getClient(gatewayName?: string): Promise<OpenShellClient> {
    const gateway = await this.#resolveGateway(gatewayName);

    const cached = this.#cache.get(gateway.name);
    if (cached) {
      return cached;
    }

    const { OpenShellClient: ClientClass } = await import('@nvidia/openshell-sdk');
    const options = await buildConnectOptions(gateway);
    const client = await ClientClass.connect(options);
    this.#cache.set(gateway.name, client);
    return client;
  }

  invalidate(gatewayName?: string): void {
    if (gatewayName) {
      this.#cache.delete(gatewayName);
    } else {
      this.#cache.clear();
    }
  }

  @preDestroy()
  dispose(): void {
    this.#cache.clear();
  }

  async #resolveGateway(gatewayName?: string): Promise<GatewayInfo> {
    const gateways = await this.openshellCli.listGateways();

    if (gatewayName) {
      const match = gateways.find(g => g.name === gatewayName);
      if (!match) {
        throw new Error(`OpenShell gateway '${gatewayName}' not found`);
      }
      return match;
    }

    const active = gateways.find(g => g.active);
    if (active) return active;

    if (gateways.length === 1) return gateways[0]!;

    if (gateways.length === 0) {
      throw new Error('No OpenShell gateways registered');
    }
    throw new Error('Multiple OpenShell gateways registered but none is active');
  }
}
