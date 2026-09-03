<script lang="ts">
import { tick } from 'svelte';
import { toast } from 'svelte-sonner';
import { router } from 'tinro';

import { currentChatId } from '/@/lib/chat/state/current-chat-id.svelte';
import type { Chat } from '/@api/chat/schema.js';

import MoreHorizontalIcon from '../icons/more-horizontal.svelte';
import PencilEditIcon from '../icons/pencil-edit.svelte';
import TrashIcon from '../icons/trash.svelte';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, useSidebar } from '../ui/sidebar';

let {
  chat,
  active,
  ondelete,
  onrename,
}: {
  chat: Chat;
  active: boolean;
  ondelete: (chatId: string) => void;
  onrename: (chatId: string, newTitle: string) => void;
} = $props();

const context = useSidebar();
let isRenaming = $state(false);
let renameInFlight = $state(false);
let newTitle = $state(chat.title);
let inputElement: HTMLInputElement | undefined = $state();

async function startRenaming(): Promise<void> {
  isRenaming = true;
  newTitle = chat.title;
  // Focus the input after it renders
  await tick();
  inputElement?.focus();
  inputElement?.select();
}

async function saveRename(): Promise<void> {
  // Guard against duplicate calls (e.g., Enter + blur)
  if (renameInFlight) {
    return;
  }
  const normalizedTitle = newTitle.trim();
  if (normalizedTitle && normalizedTitle !== chat.title) {
    renameInFlight = true;
    try {
      await window.inferenceRenameChat(chat.id, normalizedTitle);
      onrename(chat.id, normalizedTitle);
      toast.success('Chat renamed successfully');
    } catch (error) {
      console.error('Failed to rename chat', error);
      toast.error('Failed to rename chat');
      newTitle = chat.title;
    } finally {
      renameInFlight = false;
    }
  }
  isRenaming = false;
}

function cancelRename(): void {
  newTitle = chat.title;
  isRenaming = false;
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveRename().catch((err: unknown) => {
      console.error('Failed to save rename', err);
    });
  } else if (event.key === 'Escape') {
    event.preventDefault();
    cancelRename();
  }
}

function handleBlur(): void {
  saveRename().catch((err: unknown) => {
    console.error('Failed to save rename on blur', err);
  });
}

function handleClick(): void {
  currentChatId.value = chat.id;
  router.goto(`/chat/${chat.id}`);
  context.setOpenMobile(false);
}
</script>

<SidebarMenuItem>
	<SidebarMenuButton isActive={active}>
		{#snippet child({ props })}
			{#if isRenaming}
				<input
					bind:this={inputElement}
					bind:value={newTitle}
					onkeydown={handleKeydown}
					onblur={handleBlur}
					aria-label="Rename conversation"
					class="bg-sidebar-accent text-sidebar-accent-foreground flex h-8 w-full rounded-md px-2 text-sm outline-none"
					type="text"
				/>
			{:else}
				<button
					{...props}
					onclick={handleClick}
				>
					<span>{chat.title}</span>
				</button>
			{/if}
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

			<DropdownMenuItem class="cursor-pointer" onclick={startRenaming}>
				<PencilEditIcon />
				<span>Rename</span>
			</DropdownMenuItem>

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
