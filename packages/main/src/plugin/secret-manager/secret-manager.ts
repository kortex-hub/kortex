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

import type {
  Configuration,
  InferenceProviderConnection,
  RegisterInferenceConnectionEvent,
  UnregisterInferenceConnectionEvent,
} from '@openkaiden/api';
import { inject, injectable } from 'inversify';

import { IPCHandle } from '/@/plugin/api.js';
import { OpenshellGateway } from '/@/plugin/openshell-cli/openshell-gateway.js';
import { ProviderImpl } from '/@/plugin/provider-impl.js';
import { ProviderRegistry } from '/@/plugin/provider-registry.js';
import { SafeStorageRegistry } from '/@/plugin/safe-storage/safe-storage-registry.js';
import { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import { IConfigurationPropertyRecordedSchema, IConfigurationRegistry } from '/@api/configuration/models.js';
import type { OpenshellProfile } from '/@api/openshell-gateway-info.js';
import type { SecretCliBackend, SecretCreateOptions, SecretInfo, SecretName, SecretValue } from '/@api/secret-info.js';

import { OpenshellSecretAdapter } from './openshell-secret-adapter.js';

/**
 * Manages secrets by delegating to a CLI backend.
 *
 */
@injectable()
export class SecretManager {
  constructor(
    @inject(ApiSenderType)
    private readonly apiSender: ApiSenderType,
    @inject(IPCHandle)
    private readonly ipcHandle: IPCHandle,
    @inject(OpenshellSecretAdapter)
    private readonly openshellAdapter: OpenshellSecretAdapter,
    @inject(ProviderRegistry)
    private readonly providerRegistry: ProviderRegistry,
    @inject(IConfigurationRegistry)
    private readonly configurationRegistry: IConfigurationRegistry,
    @inject(SafeStorageRegistry)
    private readonly safeStorageRegistry: SafeStorageRegistry,
    @inject(OpenshellGateway)
    private readonly openshellGateway: OpenshellGateway,
  ) {}

  private get cli(): SecretCliBackend {
    return this.openshellAdapter;
  }

  async create(options: SecretCreateOptions): Promise<SecretName> {
    const result = await this.cli.createSecret(options);
    this.apiSender.send('secret-manager-update');
    return result;
  }

  async list(): Promise<SecretInfo[]> {
    return this.cli.listSecrets();
  }

  async remove(name: string): Promise<SecretName> {
    const result = await this.cli.removeSecret(name);
    this.apiSender.send('secret-manager-update');
    return result;
  }

  async listServices(): Promise<OpenshellProfile[]> {
    return this.cli.listServices();
  }

  async getSecretForModel(modelId: string): Promise<SecretInfo | undefined> {
    const info = this.providerRegistry.getInferenceConnection(modelId);
    if (!info) return undefined;

    const expectedName = `${info.providerId}-${info.connection.id}`;
    const secrets = await this.list();
    return secrets.find(s => s.name === expectedName);
  }

  async ensureSecretForModel(modelId: string): Promise<SecretInfo | undefined> {
    const existing = await this.getSecretForModel(modelId);
    if (existing) return existing;

    const info = this.providerRegistry.getInferenceConnection(modelId);
    if (!info) return undefined;

    return this.createSecretForConnection(info.providerId, info.connection, false);
  }

  async createSecretForConnection(
    providerId: string,
    connection: InferenceProviderConnection,
    checkDuplicates: boolean,
  ): Promise<SecretInfo | undefined> {
    const provider = this.providerRegistry.getProvider(providerId);
    const { config, connectionProperties } = this.getConnectionProperties(connection, provider);

    const typeEntry = connectionProperties.find(([fullKey]) => fullKey.endsWith('_type'));
    if (!typeEntry) return undefined;

    const secretType = config.get<string>(typeEntry[0]);
    if (!secretType) return undefined;

    const flagsEntry = connectionProperties.find(([fullKey]) => fullKey.endsWith('._flags'));
    const flagsRaw = flagsEntry ? config.get<string | string[]>(flagsEntry[0]) : undefined;
    const flagsValue = flagsRaw ? (Array.isArray(flagsRaw) ? flagsRaw : [flagsRaw]) : undefined;

    const configKeys = connectionProperties.filter(
      ([fullKey, _schema]) => !fullKey.endsWith('._type') && !fullKey.endsWith('._flags'),
    );

    const extensionStorage = this.safeStorageRegistry.getExtensionStorage(provider.extensionId);

    const value: SecretValue = { credentials: {} };
    if (flagsValue) {
      value.flags = flagsValue;
    }
    for (const [propertyName, schema] of configKeys) {
      const secretRefName = config.get<string>(propertyName);
      if (!secretRefName) continue;

      const actualValue = schema.format === 'password' ? await extensionStorage.get(secretRefName) : secretRefName;
      if (!actualValue) continue;

      const shortPropertyName = propertyName.split('.').pop()!;
      if (flagsValue === undefined) {
        if (schema.format === 'password') {
          value.credentials[shortPropertyName] = actualValue;
        } else {
          value.config ??= {};
          value.config[shortPropertyName] = actualValue;
        }
      } else {
        if (schema.format === 'password') {
          value.env ??= {};
          value.env[shortPropertyName] = actualValue;
        } else {
          value.config ??= {};
          value.config[shortPropertyName] = actualValue;
        }
      }
    }

    const secretName = `${providerId}-${connection.id}`;

    if (checkDuplicates) {
      const existingSecrets = await this.list();
      if (existingSecrets.some(s => s.name === secretName)) return undefined;
    }

    await this.create({
      name: secretName,
      type: secretType,
      value: value,
    });

    return { name: secretName, type: secretType };
  }

  private async onInferenceConnectionRegistered(event: RegisterInferenceConnectionEvent): Promise<void> {
    await this.createSecretForConnection(event.providerId, event.connection, true);
  }

  public getConnectionProperties(
    connection: InferenceProviderConnection,
    provider: ProviderImpl,
  ): { config: Configuration; connectionProperties: [string, IConfigurationPropertyRecordedSchema][] } {
    const config = this.configurationRegistry.getConfiguration(undefined, connection);
    const allProperties = this.configurationRegistry.getConfigurationProperties();

    const connectionProperties = Object.entries(allProperties)
      .filter(([, schema]) => {
        const scope = schema.scope;
        return Array.isArray(scope)
          ? scope.includes('InferenceProviderConnection')
          : scope === 'InferenceProviderConnection';
      })
      .filter(([_, schema]) => schema.extension?.id === provider.extensionId);
    return { config, connectionProperties };
  }

  private async onInferenceConnectionUnregistered(event: UnregisterInferenceConnectionEvent): Promise<void> {
    const expectedName = `${event.providerId}-${event.connection.id}`;
    const secrets = await this.list();
    const secret = secrets.find(s => s.name === expectedName);
    if (secret) {
      try {
        await this.remove(secret.name);
      } catch (err: unknown) {
        console.warn(`Failed to delete openshell provider ${secret.name}:`, err);
      }
    }
  }

  init(): void {
    this.providerRegistry.onDidRegisterInferenceConnection(event => {
      this.onInferenceConnectionRegistered(event).catch((err: unknown) => {
        console.error('Failed to create openshell provider for inference connection:', err);
      });
    });

    this.providerRegistry.onDidUnregisterInferenceConnection(event => {
      this.onInferenceConnectionUnregistered(event).catch((err: unknown) => {
        console.error('Failed to delete openshell provider for inference connection:', err);
      });
    });

    this.openshellGateway.onDidGatewayStart(() => {
      this.apiSender.send('secret-manager-update');
    });

    this.ipcHandle(
      'secret-manager:create',
      async (_listener: unknown, options: SecretCreateOptions): Promise<SecretName> => {
        return this.create(options);
      },
    );

    this.ipcHandle('secret-manager:list', async (): Promise<SecretInfo[]> => {
      return this.list();
    });

    this.ipcHandle('secret-manager:remove', async (_listener: unknown, name: string): Promise<SecretName> => {
      return this.remove(name);
    });

    this.ipcHandle('secret-manager:list-services', async (): Promise<OpenshellProfile[]> => {
      return this.listServices();
    });
  }
}
