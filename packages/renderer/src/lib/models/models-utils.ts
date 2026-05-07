import type { InferenceProviderConnectionType, ProviderConnectionStatus } from '@openkaiden/api';

import type { ModelInfo } from '/@/lib/chat/components/model-info';
import type { ProviderInfo } from '/@api/provider-info';

export interface CatalogModelInfo extends ModelInfo {
  connectionStatus: ProviderConnectionStatus;
  providerName: string;
}

export interface InferenceConnectionSummary {
  providerName: string;
  providerId: string;
  providerInternalId: string;
  connectionName: string;
  connectionType?: InferenceProviderConnectionType;
  status: ProviderConnectionStatus | 'not-configured';
  modelCount: number;
  creationDisplayName: string;
}

export function getModels(providerInfos: ProviderInfo[]): ModelInfo[] {
  return providerInfos.reduce(
    (accumulator, current) => {
      if (current.inferenceConnections.length > 0) {
        for (const { name, type, llmMetadata, endpoint, models } of current.inferenceConnections) {
          accumulator.push(
            ...models.map((model: { label: string }) => ({
              providerId: current.id,
              connectionName: name,
              type,
              llmMetadata: llmMetadata,
              endpoint,
              label: model.label,
            })),
          );
        }
      }
      return accumulator;
    },
    [] as Array<ModelInfo>,
  );
}

export function getCloudCatalogModels(providerInfos: ProviderInfo[]): CatalogModelInfo[] {
  return getCatalogModels(providerInfos).filter(m => m.type === 'cloud');
}

export function getInHouseCatalogModels(providerInfos: ProviderInfo[]): CatalogModelInfo[] {
  return getCatalogModels(providerInfos).filter(m => m.type === 'self-hosted');
}

export function getLocalCatalogModels(providerInfos: ProviderInfo[]): CatalogModelInfo[] {
  return getCatalogModels(providerInfos).filter(m => m.type === 'local');
}

export function getCatalogModels(providerInfos: ProviderInfo[]): CatalogModelInfo[] {
  const result: CatalogModelInfo[] = [];
  for (const provider of providerInfos) {
    for (const connection of provider.inferenceConnections ?? []) {
      for (const model of connection.models) {
        result.push({
          providerId: provider.id,
          providerName: provider.name,
          connectionName: connection.name,
          type: connection.type,
          llmMetadata: connection.llmMetadata,
          endpoint: connection.endpoint,
          label: model.label,
          connectionStatus: connection.status,
        });
      }
    }
  }
  return result;
}

export function getCloudConnectionSummaries(providerInfos: ProviderInfo[]): InferenceConnectionSummary[] {
  return getInferenceConnectionSummaries(providerInfos).filter(c => c.connectionType === 'cloud');
}

export function getInHouseConnectionSummaries(providerInfos: ProviderInfo[]): InferenceConnectionSummary[] {
  return getInferenceConnectionSummaries(providerInfos).filter(c => c.connectionType === 'self-hosted');
}

export function getLocalConnectionSummaries(providerInfos: ProviderInfo[]): InferenceConnectionSummary[] {
  return getInferenceConnectionSummaries(providerInfos).filter(c => c.connectionType === 'local');
}

export function getInferenceConnectionSummaries(providerInfos: ProviderInfo[]): InferenceConnectionSummary[] {
  const result: InferenceConnectionSummary[] = [];
  for (const provider of providerInfos) {
    const factoryTypes = provider.inferenceProviderConnectionCreationTypes ?? [];
    const creationDisplayName = provider.inferenceProviderConnectionCreationDisplayName ?? provider.name;
    const coveredTypes = new Set(provider.inferenceConnections.map(c => c.type));

    if (provider.inferenceConnections.length > 0) {
      const started = provider.inferenceConnections.find(c => c.status === 'started');
      const representative = started ?? provider.inferenceConnections[0];
      const totalModels = provider.inferenceConnections.reduce((sum, c) => sum + c.models.length, 0);
      result.push({
        providerName: provider.name,
        providerId: provider.id,
        providerInternalId: provider.internalId,
        connectionName: representative.name,
        connectionType: representative.type,
        status: representative.status,
        modelCount: totalModels,
        creationDisplayName,
      });
    }

    for (const type of factoryTypes.filter(t => !coveredTypes.has(t))) {
      result.push({
        providerName: provider.name,
        providerId: provider.id,
        providerInternalId: provider.internalId,
        connectionName: '',
        connectionType: type,
        status: 'not-configured',
        modelCount: 0,
        creationDisplayName,
      });
    }
  }
  return result;
}

export function getModelId(model: ModelInfo): string {
  return `${model.llmMetadata?.name ?? ''}::${model.label}::${model.endpoint ?? ''}`;
}
