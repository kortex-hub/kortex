import type { ProviderInfo } from '/@api/provider-info';

export interface ModelInfo {
  providerId: string;
  connectionName: string;
  label: string;
}

export function getModels(providerInfos: ProviderInfo[]): ModelInfo[] {
  return providerInfos.reduce(
    (accumulator, current) => {
      if (current.inferenceConnections.length > 0) {
        for (const { name, models } of current.inferenceConnections) {
          accumulator.push(
            ...models.map((model: { label: string }) => ({
              providerId: current.id,
              connectionName: name,
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
