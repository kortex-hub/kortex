<script lang="ts">
import { faChevronUp } from '@fortawesome/free-solid-svg-icons/faChevronUp';
import { faFilter } from '@fortawesome/free-solid-svg-icons/faFilter';
import { Button, Checkbox } from '@podman-desktop/ui-svelte';
import Fa from 'svelte-fa';

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

async function fetchTools(): Promise<void> {
  tools = undefined;
  loading = true;
  try {
    tools = await window.getMcpToolSet(mcp.id);
  } finally {
    loading = false;
  }
}
</script>

<div
  class="flex flex-col items-center flex justify-between rounded-md"
  class:border={expanded}
  class:border-[var(--pd-content-table-border)]={expanded}
>
  <div
    class="flex flex-row bg-[var(--pd-content-card-hover-bg)] py-5 px-2 w-full rounded-tr-md rounded-tl-md justify-between"
    class:rounded-b-md={!expanded}
    class:border={!expanded}
    class:border-[var(--pd-content-table-border)]={!expanded}
  >
    <div
      class="flex gap-x-2">
      <Checkbox checked={selected} onclick={onCheckMCP.bind(undefined)}/>
      <span>{mcp.name}</span>
    </div>

    {#if !expanded}
      <Button
        inProgress={loading}
        disabled={!selected}
        class="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
        title="Filter toggled tools"
        aria-label="Filter toggled tools"
        onclick={onFilter}
      >
        <Fa icon={faFilter}/>
      </Button>
    {:else}
      <Button
        class="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
        title="Stop filtering tools"
        aria-label="Stop filtering tools"
        type="danger"
        onclick={onFilter}
      >
        <Fa icon={faChevronUp}/>
      </Button>
    {/if}
  </div>
  {#if expanded && tools}
    <div class="flex flex-col bg-[var(--pd-content-card-inset-bg)] w-full rounded-b-md py-5 px-2 gap-y-1">
    {#each Object.entries(tools) as [tool] (tool)}
      <div class="flex flex-col">
        <div
          class="flex gap-x-2">
          <Checkbox checked={selectedTools?.has(tool)} onclick={onCheckTool.bind(undefined, tool)}/>
          <span>{tool}</span>
        </div>
      </div>
    {/each}
    </div>
  {/if}
</div>
