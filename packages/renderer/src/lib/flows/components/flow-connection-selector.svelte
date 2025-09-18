<script lang="ts">
import type { ClassValue } from 'svelte/elements';

import { cn } from '/@/lib/chat/utils/shadcn';
import { providerInfos } from '/@/stores/providers';
import type { ProviderFlowConnectionInfo } from '/@api/provider-info';

import CheckCircleFillIcon from '../../chat/components/icons/check-circle-fill.svelte';
import ChevronDownIcon from '../../chat/components/icons/chevron-down.svelte';
import { Button } from '../../chat/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupHeading,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../chat/components/ui/dropdown-menu';

let {
  class: c,
  value = $bindable<string | undefined>(),
}: {
  class: ClassValue;
  value: string | undefined;
} = $props();

let open = $state(false);

let groups: Map<string, Array<ProviderFlowConnectionInfo>> = $derived(
  $providerInfos.reduce((accumulator, provider) => {
    if (provider.flowConnections?.length > 0) {
      accumulator.set(provider.id, provider.flowConnections);
    }
    return accumulator;
  }, new Map()),
);

function onSelect(providerId: string, connection: ProviderFlowConnectionInfo): void {
  open = false;
  value = getKey(providerId, connection);
}

function getKey(providerId: string, connection: ProviderFlowConnectionInfo): string {
  return `${providerId}:${connection.name}`;
}
</script>

<DropdownMenu {open} onOpenChange={(val): boolean => (open = val)}>
	<DropdownMenuTrigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				class={cn(
					'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground w-fit md:h-[34px] md:px-2',
					c
				)}
			>
				{value ?? 'Select a flow connection'}
				<ChevronDownIcon />
			</Button>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent align="start" class="min-w-[300px]">
    {#each groups.entries() as [providerId, flowConnections] (providerId)}

      <DropdownMenuGroup>
        <DropdownMenuGroupHeading>
          {providerId}
        </DropdownMenuGroupHeading>
        {#each flowConnections as connection (connection.name)}
          <DropdownMenuItem
            onSelect={onSelect.bind(undefined, providerId, connection)}
            class="group/item flex flex-row items-center justify-between gap-4"
            data-active={value === getKey(providerId, connection)}
          >
            <div class="flex flex-col items-start gap-1">
              <div>{connection.name}</div>
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
