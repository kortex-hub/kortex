<script lang="ts">
interface Props {
  statusColor: string;
  connected: boolean;
}

let { statusColor, connected }: Props = $props();
</script>

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
  {#if connected}
  <path d="M9 12l2 2 4-4" />
    {:else}
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  {/if}
</svg>

