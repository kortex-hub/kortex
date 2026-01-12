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
      class="absolute top-0.5 -right-0.5 w-3 h-3 bg-[var(--pd-state-error)] rounded-full border border-[var(--pd-content-card-bg)] flex items-center justify-center"
      title="Invalid schema detected"
      aria-label="Invalid schema detected">
      <svg class="w-2 h-2" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5"
          stroke="var(--pd-content-card-bg)"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round" />
      </svg>
    </div>
  {/if}
  </div>