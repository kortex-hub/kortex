<script lang="ts">
import { SvelteSet } from 'svelte/reactivity';
import { faToolbox } from '@fortawesome/free-solid-svg-icons/faToolbox';

import {providerInfos} from '/@/stores/providers';
import type {ProviderMCPConnectionInfo} from '/@api/provider-info';
import Fa from 'svelte-fa';
import CheckCircleFillIcon from './icons/check-circle-fill.svelte';
import ChevronDownIcon from './icons/chevron-down.svelte';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupHeading,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

let {
  // selected under the form `${internalProviderId}:${connectionName}``
  selected = $bindable(new SvelteSet()),
}: {
  selected: Set<string>
} = $props();

let groups: Map<string, Array<ProviderMCPConnectionInfo>> = $derived(
  $providerInfos.reduce((accumulator, current) => {
    if(current.mcpConnections.length > 0) {
      accumulator.set(current.internalId, current.mcpConnections);
    }
    return accumulator;
  }, new Map()),
);

let open = $state(false);

function key(internalProviderId: string, connectionName: string): string {
  return `${internalProviderId}:${connectionName}`;
}

function onSelect(key: string, event: Event): void {
  event.preventDefault(); // prevent dropdown to close itself
  if(selected.has(key)) {
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
    {#each groups.entries() as [internalProviderId, mcpConnections] (internalProviderId)}
      <DropdownMenuGroup>
        <DropdownMenuGroupHeading>
          {$providerInfos.find(({ internalId}) => internalId === internalProviderId)?.name}
        </DropdownMenuGroupHeading>
        {#each mcpConnections as mcp (mcp.name)}
          {@const mcpKey = key(internalProviderId, mcp.name)}
          <DropdownMenuItem
            onSelect={onSelect.bind(undefined, mcpKey)}
            class="group/item flex flex-row items-center justify-between gap-4"
            data-active={selected.has(mcpKey)}
          >
            <div class="flex flex-col items-start gap-1">
              <div>{mcp.name}</div>
            </div>

            <div
              class="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100"
            >
              <CheckCircleFillIcon />
            </div>
          </DropdownMenuItem>
        {/each}
        <DropdownMenuSeparator/>
      </DropdownMenuGroup>
    {/each}
  </DropdownMenuContent>
</DropdownMenu>
