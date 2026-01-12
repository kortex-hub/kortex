<script lang="ts">
import type { MCPServerDetail } from '/@api/mcp/mcp-server-info';

import MCPIcon from './MCPIcon.svelte';

interface Props {
  object: MCPServerDetail;
  size?: number;
}

const { object, size = 20 }: Props = $props();

const showInvalidIndicator = $derived(object?.isValidSchema === false);
</script>

<div class="relative">
  <MCPIcon {size} />
  {#if showInvalidIndicator}
    <div
      class="absolute top-0 right-0 w-2 h-2 bg-[var(--pd-state-error)] rounded-full border border-[var(--pd-content-card-bg)]"
      title="Invalid schema detected"
      aria-label="Invalid schema detected"></div>
  {/if}
</div>
