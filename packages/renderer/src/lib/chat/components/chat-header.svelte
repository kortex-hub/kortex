<script lang="ts">
/* eslint-disable import/no-duplicates */
import { innerWidth } from 'svelte/reactivity/window';
/* eslint-enable import/no-duplicates */
import { router } from 'tinro';

import { currentChatId } from '/@/lib/chat/state/current-chat-id.svelte';

import Plus from './icons/plus.svelte';
import SidebarToggle from './sidebar-toggle.svelte';
import { Button } from './ui/button';
import { useSidebar } from './ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

const sidebar = useSidebar();
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
</header>
