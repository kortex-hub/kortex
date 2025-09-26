<script lang="ts">
import { router } from 'tinro';

import { currentChatId } from '/@/lib/chat/state/current-chat-id.svelte';
import type { Chat } from '/@api/chat/schema.js';

import MoreHorizontalIcon from '../icons/more-horizontal.svelte';
import TrashIcon from '../icons/trash.svelte';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, useSidebar } from '../ui/sidebar';

let {
  chat,
  active,
  ondelete,
}: {
  chat: Chat;
  active: boolean;
  ondelete: (chatId: string) => void;
} = $props();

const context = useSidebar();
</script>

<SidebarMenuItem>
	<SidebarMenuButton isActive={active}>
		{#snippet child({ props })}
			<button
				{...props}
				onclick={(): void => {
					currentChatId.value = chat.id;
					router.goto(`/chat/${chat.id}`);
					context.setOpenMobile(false);
				}}
			>
				<span>{chat.title}</span>
			</button>
		{/snippet}
	</SidebarMenuButton>

	<DropdownMenu>
		<DropdownMenuTrigger>
			{#snippet child({ props })}
				<SidebarMenuAction
					{...props}
					class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mr-0.5"
					showOnHover={!active}
				>
					<MoreHorizontalIcon />
					<span class="sr-only">More</span>
				</SidebarMenuAction>
			{/snippet}
		</DropdownMenuTrigger>

		<DropdownMenuContent side="bottom" align="end">
			<!-- <DropdownMenuSub>
				<DropdownMenuSubTrigger class="cursor-pointer">
					<ShareIcon />
					<span>Share</span>
				</DropdownMenuSubTrigger>
				<DropdownMenuSubContent align="start">
					<DropdownMenuItem
						class="cursor-pointer flex-row justify-between"
						onclick={(): void => {
							chatHistory.updateVisibility(chat.id, 'private').catch((err: unknown) => {
                console.error('Failed to update chat visibility', err);
              });
						}}
					>
						<div class="flex flex-row items-center gap-2">
							<LockIcon size={12} />
							<span>Private</span>
						</div>
						{#if chatFromHistory?.visibility === 'private'}
							<CheckCircleFillIcon />
						{/if}
					</DropdownMenuItem>
					<DropdownMenuItem
						class="cursor-pointer flex-row justify-between"
						onclick={(): void => {
							chatHistory.updateVisibility(chat.id, 'public').catch((err: unknown) => {
                console.error('Failed to update chat visibility', err);
              });
						}}
					>
						<div class="flex flex-row items-center gap-2">
							<GlobeIcon />
							<span>Public</span>
						</div>
						{#if chatFromHistory?.visibility === 'public'}
							<CheckCircleFillIcon />
						{/if}
					</DropdownMenuItem>
				</DropdownMenuSubContent>
			</DropdownMenuSub> -->

			<DropdownMenuItem
				class="text-destructive focus:bg-destructive/15 focus:text-destructive cursor-pointer dark:text-red-500"
				onclick={(): void => ondelete(chat.id)}
			>
				<TrashIcon />
				<span>Delete</span>
			</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
</SidebarMenuItem>
