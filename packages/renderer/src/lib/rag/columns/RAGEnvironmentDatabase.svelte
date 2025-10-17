<script lang="ts">
import { providerInfos } from '/@/stores/providers';
import type { RagEnvironment } from '/@api/rag/rag-environment';

interface Props {
  object: RagEnvironment;
}

const { object }: Props = $props();

// Extract database name from connection ID or show the ID
const ragProvider = $providerInfos
  .find(provider => provider.id === object.ragConnection.providerId);
const ragConnection = ragProvider?.ragConnections.find(
  connection => connection.name === object.ragConnection.name,
);
const databaseName = ragConnection?.name ? `${ragConnection.name} (${ragProvider?.name})` : `N/A`;
</script>

<div class="flex items-center">
  <span
    class="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
    <div class="w-4 h-4 flex-shrink-0">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        <line x1="12" y1="22.08" x2="12" y2="12"></line>
      </svg>
    </div>
    <span>{databaseName}</span>
  </span>
</div>
