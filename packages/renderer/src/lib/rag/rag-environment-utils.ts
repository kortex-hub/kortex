import type { ProviderInfo } from '/@api/provider-info';
import type { RagEnvironment } from '/@api/rag/rag-environment';

export function getDatabaseName(providerInfos: ProviderInfo[], ragEnvironment: RagEnvironment | undefined): string {
  const ragProvider = providerInfos.find(provider => provider.id === ragEnvironment?.ragConnection.providerId);
  const ragConnection = ragProvider?.ragConnections.find(
    connection => connection.name === ragEnvironment?.ragConnection.name,
  );
  return ragConnection?.name ? `${ragConnection.name} (${ragProvider?.name})` : 'N/A';
}

export function getChunkProviderName(
  providerInfos: ProviderInfo[],
  ragEnvironment: RagEnvironment | undefined,
): string {
  if (!ragEnvironment) return 'N/A';
  const provider = providerInfos.find(p => p.id === ragEnvironment.chunkerConnection.providerId);
  const connection = provider?.chunkConnections.find(c => c.id === ragEnvironment.chunkerConnection.id);
  return connection ? `${connection.name} (${provider?.name})` : 'N/A';
}
