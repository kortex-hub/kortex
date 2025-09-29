<script lang="ts">
import type { MCPRegistry, MCPRegistrySuggestedProvider } from '@kortex-app/api';

interface Props {
  items: Array<MCPRegistry | MCPRegistrySuggestedProvider>;
  selected: MCPRegistry | MCPRegistrySuggestedProvider | undefined;
}

let { items, selected = $bindable() }: Props = $props();
</script>

<select
  class="text-sm rounded-lg block w-full p-2.5 bg-[var(--pd-dropdown-bg)] pl-6 border-r-8 border-transparent outline"
  bind:value={selected}
  name="mcp registry"
>
  {#each items as target, index (index)}
    {#if 'url' in target}
      <option value={target}>{target.url}</option>
    {:else}
      <option value={target}>{target.serverUrl}</option>
    {/if}
  {/each}
</select>
