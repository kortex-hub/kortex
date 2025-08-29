<script lang="ts">
/* eslint-disable import/no-duplicates */
import { SvelteSet } from 'svelte/reactivity';
import { innerWidth } from 'svelte/reactivity/window';
/* eslint-enable import/no-duplicates */
import { router } from 'tinro';

import type { ModelInfo } from '/@/lib/chat/components/model-info';
import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';

import type { Chat, User } from '../../../../../main/src/chat/db/schema';
import PlusIcon from './icons/plus.svelte';
import MCPSelector from './mcp-selector.svelte';
import ModelSelector from './model-selector.svelte';
import SidebarToggle from './sidebar-toggle.svelte';
import { Button } from './ui/button';
import { useSidebar } from './ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import VisibilitySelector from './visibility-selector.svelte';

let {
  user,
  chat,
  readonly,
  models,
  selectedModel = $bindable<ModelInfo | undefined>(),
  // selected under the form `${internalProviderId}:${connectionName}``
  selectedMCP = $bindable(new SvelteSet()),
}: {
  user: User | undefined;
  chat: Chat | undefined;
  readonly: boolean;
  selectedModel: ModelInfo | undefined;
  models: Array<ModelInfo>;
  selectedMCP: Set<string>;
} = $props();

const sidebar = useSidebar();

const noMcps = $derived($mcpRemoteServerInfos.length === 0);
</script>

<header class="bg-background sticky top-0 flex items-start gap-2 p-2">
	<SidebarToggle />

	{#if !sidebar.open || (innerWidth.current ?? 768) < 768}
		<Tooltip>
			<TooltipTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="outline"
						class="order-2 ml-auto px-2 md:order-1 md:ml-0 md:h-fit md:px-2"
						onclick={():void => {
							router.goto('/');
						}}
					>
						<PlusIcon />
						<span class="md:sr-only">New Chat</span>
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
            <MCPSelector disabled={noMcps} bind:selected={selectedMCP}/>
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
            {/if}
        </div>
    {/if}
    
    {#if !readonly && chat}
		<VisibilitySelector {chat} class="order-1 md:order-3" />
	{/if}

	{#if !user}
		<Button href="/signin" class="order-5 px-2 py-1.5 md:h-[34px]">Sign In</Button>
	{/if}

</header>
