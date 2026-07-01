/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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
import { randomUUID } from 'node:crypto';

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { CoreV1Api, CustomObjectsApi, KubeConfig } from '@kubernetes/client-node';
import type {
  Disposable,
  InferenceModel,
  InferenceProviderConnection,
  Provider,
  provider as ProviderAPI,
  ProviderConnectionStatus,
  SecretStorage,
} from '@openkaiden/api';
import { configuration } from '@openkaiden/api';

export const PROVIDER_ID = 'openshiftai';
export const TOKENS_KEY = 'openshiftai:infos';

export interface StoredConnection {
  id: string;
  url: string;
  token: string;
  baseURL: string;
}

interface ConnectionInfo {
  token: string;
  baseURL: string;
}

export class OpenShiftAI implements Disposable {
  private provider: Provider | undefined = undefined;
  private connections: Map<string, Disposable> = new Map();

  constructor(
    private readonly providerAPI: typeof ProviderAPI,
    private readonly secrets: SecretStorage,
  ) {}

  async init(): Promise<void> {
    // create provider
    this.provider = this.providerAPI.createProvider({
      name: 'OpenShift AI',
      status: 'unknown',
      id: PROVIDER_ID,
      emptyConnectionMarkdownDescription:
        'Provides OpenShift AI integration. Connects Kaiden to models running on OpenShift AI.',
      images: {
        icon: {
          light: './icon_light.png',
          dark: './icon_dark.png',
        },
        logo: {
          light: './icon_light.png',
          dark: './icon_dark.png',
        },
      },
    });

    // register inference Provider connection factory
    this.provider.setInferenceProviderConnectionFactory({
      connectionTypes: ['self-hosted'],
      create: this.inferenceFactory.bind(this),
    });

    // restore persistent connections
    await this.restoreConnections();
  }

  private async restoreConnections(): Promise<void> {
    const stored = await this.getStoredConnections();
    for (const entry of stored) {
      try {
        const services = await this.getInferenceServices(entry.url, entry.token);
        const matching = services.find(s => s.baseURL === entry.baseURL);
        if (!matching) {
          console.error(`OpenShift AI: inference service at ${entry.baseURL} no longer available`);
          continue;
        }
        await this.registerSingleConnection(entry, matching);
      } catch (err: unknown) {
        console.error(`OpenShift AI: failed to restore connection for ${entry.url}`, err);
      }
    }
  }

  private async getStoredConnections(): Promise<StoredConnection[]> {
    let raw: string | undefined;
    try {
      raw = await this.secrets.get(TOKENS_KEY);
    } catch (err: unknown) {
      console.error('OpenShift AI: something went wrong while trying to get tokens from secret storage', err);
    }
    if (!raw) return [];

    try {
      return JSON.parse(raw) as StoredConnection[];
    } catch {
      // Migrate legacy pipe/comma-separated format: token|url,token|url
      const entries = raw.split(',');
      const migrated: StoredConnection[] = [];
      for (const entry of entries) {
        const [token, url] = entry.split('|');
        const services = await this.getInferenceServices(url, token);
        for (const service of services) {
          migrated.push({ id: randomUUID(), url, token, baseURL: service.baseURL });
        }
      }
      await this.secrets.store(TOKENS_KEY, JSON.stringify(migrated));
      return migrated;
    }
  }

  private async saveConnection(connection: StoredConnection): Promise<void> {
    const stored = await this.getStoredConnections();
    stored.push(connection);
    await this.secrets.store(TOKENS_KEY, JSON.stringify(stored));
  }

  private async removeConnection(id: string): Promise<void> {
    const stored = await this.getStoredConnections();
    const filtered = stored.filter(entry => entry.id !== id);
    await this.secrets.store(TOKENS_KEY, JSON.stringify(filtered));
  }

  private getSecretName(connectionId: string): string {
    return `${PROVIDER_ID}:${connectionId}:token`;
  }

  private async setConnectionConfiguration(
    connection: InferenceProviderConnection,
    stored: StoredConnection,
  ): Promise<void> {
    const secretName = this.getSecretName(connection.id);
    await this.secrets.store(secretName, stored.token);

    const config = configuration.getConfiguration(undefined, connection);
    await config.update('openshiftai.connection._type', PROVIDER_ID);
    await config.update('openshiftai.connection.token', secretName);
  }

  private async clearConnectionConfiguration(connection: InferenceProviderConnection): Promise<void> {
    const secretName = this.getSecretName(connection.id);
    await this.secrets.delete(secretName);

    const config = configuration.getConfiguration(undefined, connection);
    await config.update('openshiftai.connection._type', undefined);
    await config.update('openshiftai.connection.token', undefined);
  }

  protected async listModels({ baseURL, token }: ConnectionInfo): Promise<Array<InferenceModel>> {
    const res = await fetch(`${baseURL}/models`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.status !== 200) throw new Error('failed to list models');
    const body = await res.json();

    if (!('data' in body)) throw new Error(`malformed response from ${baseURL}`);
    if (!Array.isArray(body.data)) throw new Error(`malformed response from ${baseURL}: data is not an array`);

    return body.data.map((model: { id: string }) => ({ label: model.id }));
  }

  private async getToken(coreAPI: CoreV1Api, namespace: string, runtime: string): Promise<string> {
    const secrets = await coreAPI.listNamespacedSecret({ namespace });
    for (const secret of secrets.items) {
      if (secret.metadata?.annotations?.['kubernetes.io/service-account.name'] === runtime) {
        if (secret.data?.['token']) {
          return Buffer.from(secret.data['token'], 'base64').toString('utf-8');
        }
      }
    }
    throw new Error(`Failed to find token for runtime ${runtime}`);
  }

  private async getInferenceServices(url: string, token: string): Promise<ConnectionInfo[]> {
    const urls: ConnectionInfo[] = [];
    try {
      const user = {
        name: token,
        token,
      };
      const cluster = {
        name: 'openshift-ai',
        server: url,
        skipTLSVerify: true,
      };
      const context = {
        cluster: cluster.name,
        user: user.name,
        name: 'openshift-ai',
      };
      const kc = new KubeConfig();
      kc.loadFromOptions({
        clusters: [cluster],
        users: [user],
        contexts: [context],
        currentContext: context.name,
      });
      const coreAPI = kc.makeApiClient(CoreV1Api);
      const genericAPI = kc.makeApiClient(CustomObjectsApi);
      const projects = await genericAPI.listClusterCustomObject({
        group: 'project.openshift.io',
        version: 'v1',
        plural: 'projects',
      });
      for (const project of projects.items) {
        if (project.metadata?.name) {
          const inferenceServices = await genericAPI.listNamespacedCustomObject({
            group: 'serving.kserve.io',
            version: 'v1beta1',
            namespace: project.metadata.name,
            plural: 'inferenceservices',
          });
          for (const inferenceService of inferenceServices.items) {
            try {
              const token = await this.getToken(
                coreAPI,
                project.metadata.name,
                `${inferenceService.spec?.predictor?.model?.runtime}-sa`,
              );
              if (token && inferenceService.status.url) {
                urls.push({
                  token,
                  baseURL: `${inferenceService.status.url}/v1`,
                });
              }
            } catch (e) {
              console.error(`Error processing inference service ${inferenceService.metadata.name}`, e);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error getting inference services:', e);
    }
    return urls;
  }

  private async registerSingleConnection(stored: StoredConnection, serviceInfo: ConnectionInfo): Promise<void> {
    if (!this.provider) throw new Error('cannot create MCP provider connection: provider is not initialized');

    if (this.connections.has(stored.id)) {
      throw new Error(`connection already exists for baseURL ${serviceInfo.baseURL}`);
    }

    const models = await this.listModels(serviceInfo);

    const openai = createOpenAICompatible({
      baseURL: serviceInfo.baseURL,
      apiKey: serviceInfo.token,
      name: serviceInfo.baseURL,
    });

    const connection: InferenceProviderConnection = {
      id: stored.id,
      name: stored.url,
      type: 'self-hosted',
      endpoint: serviceInfo.baseURL,
      sdk: openai,
      status(): ProviderConnectionStatus {
        return 'unknown';
      },
      lifecycle: {
        delete: async (): Promise<void> => {
          await this.clearConnectionConfiguration(connection);
          this.connections.get(stored.id)?.dispose();
          this.connections.delete(stored.id);
          await this.removeConnection(stored.id);
        },
      },
      models: models,
      credentials(): Record<string, string> {
        return {
          'openshiftai:tokens': stored.token,
        };
      },
    };

    await this.setConnectionConfiguration(connection, stored);

    try {
      const connectionDisposable = this.provider.registerInferenceProviderConnection(connection);
      this.connections.set(stored.id, connectionDisposable);
    } catch (err: unknown) {
      await this.clearConnectionConfiguration(connection);
      throw err;
    }
  }

  private async inferenceFactory(params: { [p: string]: unknown }): Promise<void> {
    const url = params['openshiftai.factory.url'];
    if (!url || typeof url !== 'string') throw new Error('invalid OpenShift AI URL');

    const token = params['openshiftai.factory.token'];
    if (!token || typeof token !== 'string') throw new Error('invalid token');

    const services = await this.getInferenceServices(url, token);
    if (services.length === 0) {
      throw new Error('no inference services found on the cluster');
    }

    for (const service of services) {
      const connection: StoredConnection = { id: randomUUID(), url, token, baseURL: service.baseURL };
      await this.registerSingleConnection(connection, service);
      await this.saveConnection(connection);
    }
  }

  dispose(): void {
    this.provider?.dispose();
    this.connections.forEach(disposable => disposable.dispose());
    this.connections.clear();
  }
}
