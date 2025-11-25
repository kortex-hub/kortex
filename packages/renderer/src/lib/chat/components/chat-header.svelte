<script lang="ts">
/* eslint-disable import/no-duplicates */
import { innerWidth } from 'svelte/reactivity/window';
/* eslint-enable import/no-duplicates */
import { router } from 'tinro';

import type { ModelInfo } from '/@/lib/chat/components/model-info';
import ModelSelector from '/@/lib/chat/components/model-selector.svelte';
import { currentChatId } from '/@/lib/chat/state/current-chat-id.svelte';
import { cn } from '/@/lib/chat/utils/shadcn';
import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';

import Plus from './icons/plus.svelte';
import SidebarToggle from './sidebar-toggle.svelte';
import { Button } from './ui/button';
import { useSidebar } from './ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

let {
  readonly,
  models,
  selectedModel = $bindable<ModelInfo | undefined>(),
  selectedMCPCount,
  mcpSelectorOpen = $bindable(),
}: {
  readonly: boolean;
  selectedModel: ModelInfo | undefined;
  models: Array<ModelInfo>;
  selectedMCPCount: number;
  mcpSelectorOpen: boolean;
} = $props();

const sidebar = useSidebar();

const noMcps = $derived($mcpRemoteServerInfos.length === 0);

function onToolSelection(): void {
  mcpSelectorOpen = true;
}
</script>

<header class="bg-background sticky top-0 flex items-start gap-2 p-2">
	<SidebarToggle />

	{#if !sidebar.open || (innerWidth.current ?? 768) < 768}
		<Tooltip>
			<TooltipTrigger>
				{#snippet child({ props })}
				<Button
					{...props}
					variant="default"
					class="order-0 ml-auto px-2 md:ml-0 md:h-fit md:px-2"
					onclick={():void => {
            	currentChatId.value = undefined;
              if ($router.path === '/') {
                router.goto('/chat');
              } else {
                router.goto('/');
              }
            }}
					>
						<Plus />
						<span>New Chat</span>
					</Button>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent side="bottom" >New Chat</TooltipContent>
		</Tooltip>
	{/if}

	{#if !readonly}
        <ModelSelector
            class="order-1 md:order-2"
            models={models}
            bind:value={selectedModel}
        />
        <div class="flex flex-col gap-1">
            {#if noMcps}
                <div class="flex items-center gap-1 px-1 text-xs text-muted-foreground">
                    <Button
                        variant="link"
                        class="h-auto p-0 text-xs hover:underline"
                        onclick={():void => router.goto('/mcps')}
                    >
                        Configure MCP servers
                    </Button>
                </div>
            {:else}
              <Button
                aria-label="Tools Selection"
                variant="outline"
                onclick={onToolSelection}
                class={cn(
					'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground w-fit md:h-[34px] md:px-2',
				)}>Tools Selection ({selectedMCPCount})</Button>
            {/if}
        </div>
    {/if}

    <!-- {#if !readonly && chat}
		<VisibilitySelector {chat} class="order-1 md:order-3" />
	{/if} -->

</header>
