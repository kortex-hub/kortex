<script lang="ts">
import { Checkbox } from '@podman-desktop/ui-svelte';

import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';

interface Props {
  mcp: MCPRemoteServerInfo;
  selected: boolean;
  selectedTools?: Set<string>;
  onCheckMCP: (checked: boolean) => void;
  onCheckTool: (toolId: string, checked: boolean) => void;
  onClearTools: () => void;
}

let { mcp, selected, onCheckMCP, selectedTools, onCheckTool, onClearTools }: Props = $props();

let loading: boolean = $state(false);
let filtering: boolean = $state(false);
let tools: Record<string, { description: string }> | undefined = $state(undefined);
let expanded: boolean = $derived(selected && filtering && !!tools);

function onFilter(): void {
  if (filtering) {
    filtering = false;
    onClearTools();
  } else {
    fetchTools().catch(console.error);
    filtering = true;
  }
}

  if (selectedTools.size === 0) return 'none';
  else if (selectedTools.size === tools.length) return 'all';
  return 'partial';
});
</script>

<div
  class="flex flex-col items-center flex justify-between rounded-md border border-[var(--pd-content-table-border)]"
>
  <div
    class="flex flex-row bg-[var(--pd-content-card-hover-bg)] py-5 px-2 w-full rounded-tr-md rounded-tl-md justify-between"
  >
    <div
      class="flex gap-x-2">
      <Checkbox checked={selected} onclick={onCheckMCP.bind(undefined)}/>
      <span>{mcp.name}</span>
    </div>
  </div>
  <div class="flex flex-col bg-[var(--pd-content-card-inset-bg)] w-full rounded-b-md py-2 px-2 gap-y-1">
    {#each filtered as [tool, { description }] (tool)}
      {@const checked = selectedTools?.has(tool)}
      <div class="flex flex-col">
        <div
          class="flex gap-x-2">
          <Checkbox checked={selectedTools?.has(tool)} onclick={onCheckTool.bind(undefined, tool)}/>
          <span>{tool}</span>
        </div>
      </div>
    {/each}
  </div>
</div>
