<script lang="ts">
import RAGEnvironmentIcon from '/@/lib/images/RAGEnvironmentIcon.svelte';
import type { RagEnvironment } from '/@api/rag/rag-environment';

interface Props {
  object: RagEnvironment;
}

const { object }: Props = $props();

const isConnected = $derived(!!object.mcpServer);
const statusColor = $derived(isConnected ? 'var(--pd-status-running)' : 'var(--pd-status-stopped)');
const statusText = $derived(isConnected ? 'Connected' : 'Disconnected');
</script>

<div class="flex items-center justify-center gap-1" title={statusText}>
  <RAGEnvironmentIcon statusColor={statusColor} connected={isConnected} />
</div>
