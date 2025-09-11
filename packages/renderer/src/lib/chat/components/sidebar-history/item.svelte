<script lang="ts">
import { router } from 'tinro';

import type { DBChat } from '../../../../../../main/src/chat/db/schema';
import MoreHorizontalIcon from '../icons/more-horizontal.svelte';
import TrashIcon from '../icons/trash.svelte';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, useSidebar } from '../ui/sidebar';

let {
  chat,
  active,
  ondelete,
}: {
  chat: DBChat;
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
