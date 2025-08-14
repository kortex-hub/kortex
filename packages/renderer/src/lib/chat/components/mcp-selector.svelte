<script lang="ts">
import { SvelteSet } from 'svelte/reactivity';
import { faToolbox } from '@fortawesome/free-solid-svg-icons/faToolbox';

import Fa from 'svelte-fa';
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
import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';

let {
  // selected under the form `${internalProviderId}:${connectionName}``
  selected = $bindable(new SvelteSet()),
}: {
  selected: Set<string>;
} = $props();

let open = $state(false);

function onSelect(key: string, event: Event): void {
  event.preventDefault(); // prevent dropdown to close itself
  if (selected.has(key)) {
    selected.delete(key);
  } else {
    selected.add(key);
  }
}
</script>

<DropdownMenu {open} onOpenChange={(val) => (open = val)}>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="outline"
        class="data-[state=open]:bg-accent data-[state=open]:text-accent-foreground w-fit md:h-[34px] md:px-2"
      >
        <Fa icon={faToolbox} />
        {selected.size} selected
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
            onSelect={onSelect.bind(undefined, mcpRemoteServerInfo.id)}
            class="group/item flex flex-row items-center justify-between gap-4"
            data-active={selected.has(mcpRemoteServerInfo.id)}
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
