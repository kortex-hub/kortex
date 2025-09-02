<script lang="ts">
import { faToolbox } from '@fortawesome/free-solid-svg-icons/faToolbox';
import Fa from 'svelte-fa';

import { cn } from '/@/lib/chat/utils/shadcn';
import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';

import CheckCircleFillIcon from './icons/check-circle-fill.svelte';
import ChevronDownIcon from './icons/chevron-down.svelte';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface Props {
  selected: MCPRemoteServerInfo[];
  class?: string;
  disabled?: boolean;
  open?: boolean;
}

let { selected = $bindable(), class: className, disabled = false, open = $bindable(false) }: Props = $props();

function onSelect(mcp: MCPRemoteServerInfo, event: Event): void {
  event.preventDefault(); // prevent dropdown to close itself

  const index = selected.findIndex(s => s.id === mcp.id);
  if (index > -1) {
    selected.splice(index, 1);
  } else {
    selected.push(mcp);
  }
}
</script>

<DropdownMenu {open} onOpenChange={(val): boolean => (open = val)}>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="outline"
        disabled={disabled}
        class={cn('data-[state=open]:bg-accent data-[state=open]:text-accent-foreground w-fit md:h-[34px] md:px-2', className)}
      >
        <Fa icon={faToolbox} />
        {selected.length} selected
        <ChevronDownIcon />
      </Button>
    {/snippet}
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start" class="min-w-[300px]">
    {#if $mcpRemoteServerInfos.length === 0}
          <DropdownMenuItem
            disabled
            class="group/item flex flex-row items-center justify-between gap-4"
          >
          No MCP available
          </DropdownMenuItem>
    {/if}
      <DropdownMenuGroup>
        {#each $mcpRemoteServerInfos as mcpRemoteServerInfo (mcpRemoteServerInfo.id)}
          <DropdownMenuItem
            onSelect={onSelect.bind(undefined, mcpRemoteServerInfo)}
            class="group/item flex flex-row items-center justify-between gap-4"
            data-active={selected.find(s => s.id === mcpRemoteServerInfo.id)}
          >
            <div class="flex flex-col items-start gap-1">
              <div>{mcpRemoteServerInfo.name}</div>
            </div>

            <div
              class="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100"
            >
              <CheckCircleFillIcon />
            </div>
          </DropdownMenuItem>
        {/each}
      </DropdownMenuGroup>
  </DropdownMenuContent>
</DropdownMenu>
