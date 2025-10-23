<script lang="ts">
import type { ClassValue } from 'svelte/elements';

import type { ModelInfo } from '/@/lib/chat/components/model-info';
import { cn } from '/@/lib/chat/utils/shadcn';

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
  class: c,
  models,
  value = $bindable<ModelInfo | undefined>(),
}: {
  class: ClassValue;
  value: ModelInfo | undefined;
  models: Array<ModelInfo>;
} = $props();

let groups: Map<string, Array<ModelInfo>> = $derived(
  Map.groupBy(models, ({ providerId, connectionName }) => `${providerId}:${connectionName}`),
);

let open = $state(false);
const selectedChatModelDetails = $derived(
  models
    .values()
    .find(
      model =>
        model.label === value?.label &&
        model.providerId === value?.providerId &&
        model.connectionName === value?.connectionName,
    ),
);

function onSelect(model: ModelInfo): void {
  open = false;
  value = model;
}
</script>

<DropdownMenu {open} onOpenChange={(val): boolean => (open = val)}>
	<DropdownMenuTrigger>
		{#snippet child({ props })}
			<Button
				{...props}
				aria-label="Select model"
				variant="outline"
				class={cn(
					'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground w-fit md:h-[34px] md:px-2',
					c
				)}
			>
				{selectedChatModelDetails?.label}
				<ChevronDownIcon />
			</Button>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent align="start" class="min-w-[300px]">
    {#each groups.entries() as [key, mModels] (key)}

      <DropdownMenuGroup>
        <DropdownMenuGroupHeading>
          {key}
        </DropdownMenuGroupHeading>
        {#each mModels as model (model.label)}
          <DropdownMenuItem
            onSelect={onSelect.bind(undefined, model)}
            class="group/item flex flex-row items-center justify-between gap-4"
            data-active={model.label === value?.label && model.providerId === value?.providerId && model.connectionName === value?.connectionName}
          >
            <div class="flex flex-col items-start gap-1">
              <div>{model.label}</div>
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
