<script lang="ts">
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
  {#if isConnected}
    <!-- Connected icon - checkmark in circle -->
    <svg
      class="w-4 h-4"
      style="color: {statusColor}"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  {:else}
    <!-- Disconnected icon - circle with X -->
    <svg
      class="w-4 h-4"
      style="color: {statusColor}"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  {/if}
</div>
