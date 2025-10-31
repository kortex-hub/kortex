<script lang="ts">
/* eslint-disable import/no-duplicates */
import { innerWidth } from 'svelte/reactivity/window';
/* eslint-enable import/no-duplicates */
import { router } from 'tinro';

import type { ModelInfo } from '/@/lib/chat/components/model-info';
import ModelSelector from '/@/lib/chat/components/model-selector.svelte';
import { currentChatId } from '/@/lib/chat/state/current-chat-id.svelte';
import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';
import type { RagEnvironment } from '/@api/rag/rag-environment';

import PenToSquareIcon from './icons/PenToSquareIcon.svelte';
import MCPSelector from './mcp-selector.svelte';
import RagEnvironmentSelector from './rag-environment-selector.svelte';
import SidebarToggle from './sidebar-toggle.svelte';
import { Button } from './ui/button';
import { useSidebar } from './ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

let {
  readonly,
  models,
  selectedModel = $bindable<ModelInfo | undefined>(),
  // selected under the form `${internalProviderId}:${connectionName}``
  selectedMCP = $bindable(),
  mcpSelectorOpen = $bindable(),
}: {
  readonly: boolean;
  selectedModel: ModelInfo | undefined;
  models: Array<ModelInfo>;
  selectedMCP: MCPRemoteServerInfo[];
  mcpSelectorOpen: boolean;
} = $props();

const sidebar = useSidebar();

const noMcps = $derived($mcpRemoteServerInfos.length === 0);

let selectedRagEnvironment = $state<RagEnvironment | undefined>(undefined);

function onSelectRagEnvironment(ragEnvironment: RagEnvironment | undefined): void {
  if (selectedRagEnvironment) {
    selectedMCP = selectedMCP.filter(mcp => mcp.id !== selectedRagEnvironment?.mcpServer?.id);
  }
  if (ragEnvironment?.mcpServer) {
    selectedMCP.push(ragEnvironment.mcpServer);
  }
  selectedRagEnvironment = ragEnvironment;
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
						variant="outline"
						class="order-2 ml-auto px-2 md:order-1 md:ml-0 md:h-fit md:px-2"
						onclick={() => {
            	currentChatId.value = undefined;
              if ($router.path === '/') {
                router.goto('/chat');
              } else {
                router.goto('/');
              }
            } }
					>
						<PenToSquareIcon />
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
        <RagEnvironmentSelector
            class="order-2 md:order-3"
            onSelect={onSelectRagEnvironment}
        />
        <div class="flex flex-col gap-1">
            <MCPSelector disabled={noMcps} bind:open={mcpSelectorOpen} bind:selected={selectedMCP}/>
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

    <!-- {#if !readonly && chat}
		<VisibilitySelector {chat} class="order-1 md:order-3" />
	{/if} -->

</header>
