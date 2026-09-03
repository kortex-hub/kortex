<script lang="ts">
import { Checkbox } from '@podman-desktop/ui-svelte';

import { Tooltip, TooltipContent, TooltipTrigger } from '/@/lib/chat/components/ui/tooltip';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';

interface Props {
  mcp: MCPRemoteServerInfo;
  selectedTools?: Set<string>;
  onCheckMCP: (checked: boolean) => void;
  onCheckTool: (toolId: string, checked: boolean) => void;
  searchTerm: string;
}

let { mcp, onCheckMCP, selectedTools, searchTerm, onCheckTool }: Props = $props();

let tools = $derived(Object.entries(mcp.tools));
let filtered = $derived(
  searchTerm.length > 0
    ? tools.filter(([toolId, { description }]) => toolId.includes(searchTerm) || description?.includes(searchTerm))
    : tools,
);

let selection: 'all' | 'none' | 'partial' = $derived.by(() => {
  if (!selectedTools) return 'none';

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
      <Checkbox
        checked={selection === 'all'}
        indeterminate={selection === 'partial'}
        onclick={onCheckMCP.bind(undefined)}/>
      <span>{mcp.name}</span>
    </div>
  </div>
  <div class="flex flex-col bg-[var(--pd-content-card-inset-bg)] w-full rounded-b-md py-2 px-2 gap-y-1">
    {#each filtered as [tool, { description }] (tool)}
      {@const checked = selectedTools?.has(tool)}
      <div class="flex flex-col">
        <div
          class:bg-[var(--pd-content-card-hover-bg)]={checked}
          class="flex gap-x-2 items-center rounded-md p-2">
          <Checkbox checked={checked} onclick={onCheckTool.bind(undefined, tool)}/>
          <Tooltip>
            <TooltipTrigger>
              {#snippet child({ props })}
                <div {...props} class="flex flex-col w-full overflow-hidden">
                  <span class="font-bold">{tool}</span>
                  <code class="text-ellipsis overflow-hidden line-clamp-1">{description}</code>
                </div>
              {/snippet}
            </TooltipTrigger>
            <TooltipContent>{description}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    {/each}
  </div>
</div>
