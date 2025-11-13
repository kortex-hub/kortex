<script lang="ts">
import { router } from 'tinro';

import { currentChatId } from '/@/lib/chat/state/current-chat-id.svelte';

import Plus from './icons/plus.svelte';
import { SidebarHistory } from './sidebar-history';
import { Button } from './ui/button';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, useSidebar } from './ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface Props {
  chatId?: string;
}
let { chatId }: Props = $props();
const context = useSidebar();
</script>

{#if context.open}
<Sidebar class="group-data-[side=left]:border-r-0">
	<SidebarHeader>
		<SidebarMenu>
			<div class="flex h-10 flex-row items-center justify-between md:h-[34px]">
				<a
					href="/"
					onclick={(): void => {
						context.setOpenMobile(false);
					}}
					class="flex flex-row items-center gap-3"
				>
					<span class="hover:bg-muted cursor-pointer rounded-md px-2 text-lg font-semibold">
						Chatbot
					</span>
				</a>
				<Tooltip>
					<TooltipTrigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="default"
								type="button"
								class="h-fit p-2"
								onclick={(): void => {
									context.setOpenMobile(false);
									currentChatId.value = undefined;
									if ($router.path === '/') {
										router.goto('/chat');
									} else {
										router.goto('/');
									}
								}}
							>
								<Plus />
							</Button>
						{/snippet}
					</TooltipTrigger>
					<TooltipContent side="bottom" align="end">New Chat</TooltipContent>
				</Tooltip>
			</div>
		</SidebarMenu>
	</SidebarHeader>
	<SidebarContent>
		<SidebarHistory {chatId} />
	</SidebarContent>
</Sidebar>
{/if}
