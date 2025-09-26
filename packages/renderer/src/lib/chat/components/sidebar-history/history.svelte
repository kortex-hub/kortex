<script lang="ts">
import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import { toast } from 'svelte-sonner';
import { router } from 'tinro';

import { ChatHistory } from '/@/lib/chat/hooks/chat-history.svelte';
import { withConfirmation } from '/@/lib/dialogs/messagebox-utils';
import type { Chat } from '/@api/chat/schema.js';

import { Button } from '../ui/button';
import { SidebarGroup, SidebarGroupContent, SidebarMenu } from '../ui/sidebar';
import { Skeleton } from '../ui/skeleton';
import ChatItem from './item.svelte';

interface Props {
  chatId?: string;
}

let { chatId }: Props = $props();
const chatHistory = ChatHistory.fromContext();
const groupedChats = $derived(groupChatsByDate(chatHistory.chats));
let chatIdToDelete = $state<string | undefined>(undefined);

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};
const chatGroupTitles = {
  today: 'Today',
  yesterday: 'Yesterday',
  lastWeek: 'Last 7 days',
  lastMonth: 'Last 30 days',
  older: 'Older',
} as const;

function groupChatsByDate(chats: Chat[]): GroupedChats {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats,
  );
}

async function handleDeleteChat(): Promise<void> {
  const deletePromise = (async (): Promise<void> => {
    if (!chatIdToDelete) {
      throw new Error();
    }
    await window.inferenceDeleteChat(chatIdToDelete);
  })();

  toast.promise(deletePromise, {
    loading: 'Deleting chat...',
    success: () => {
      chatHistory.chats = chatHistory.chats.filter(chat => chat.id !== chatIdToDelete);
      chatHistory.refetch().catch((err: unknown) => {
        console.error('Failed to refetch chat history', err);
      });
      return 'Chat deleted successfully';
    },
    error: 'Failed to delete chat',
  });

  if (chatIdToDelete === chatId) {
    router.goto('/');
  }
}

async function handleDeleteAllChats(): Promise<void> {
  const deleteAllPromise = window.inferenceDeleteAllChats();

  toast.promise(deleteAllPromise, {
    loading: 'Deleting all chats...',
    success: () => {
      chatHistory.refetch().catch((err: unknown) => {
        console.error('Failed to refetch chat history', err);
      });
      return 'All chats deleted successfully';
    },
    error: 'Failed to delete all chats',
  });
}
</script>

{#if chatHistory.loading}
	<SidebarGroup>
		<div class="text-sidebar-foreground/50 px-2 py-1 text-xs">Today</div>
		<SidebarGroupContent>
			<div class="flex flex-col">
				{#each [44, 32, 28, 64, 52] as width (width)}
					<div class="flex h-8 items-center gap-2 rounded-md px-2">
						<Skeleton
							class="bg-sidebar-accent-foreground/10 h-4 max-w-[--skeleton-width] flex-1"
							style="--skeleton-width: {width}%"
						/>
					</div>
				{/each}
			</div>
		</SidebarGroupContent>
	</SidebarGroup>
{:else if chatHistory.chats.length === 0}
	<SidebarGroup>
		<SidebarGroupContent>
			<div
				class="flex w-full flex-row items-center justify-center gap-2 px-2 text-sm text-zinc-500"
			>
				Your conversations will appear here once you start chatting!
			</div>
		</SidebarGroupContent>
	</SidebarGroup>
{:else}
	<SidebarGroup>
		<SidebarGroupContent>
			<SidebarMenu>
				{#each Object.entries(groupedChats) as [group, chats] (group)}
					{#if chats.length > 0}
						<div class="text-sidebar-foreground/50 px-2 py-1 text-xs">
							{chatGroupTitles[group as keyof typeof chatGroupTitles]}
						</div>
						{#each chats as chat (chat.id)}
							<ChatItem
								{chat}
								active={chat.id === chatId}
								ondelete={(chatId): void => {
									chatIdToDelete = chatId;
									withConfirmation(handleDeleteChat, 'This action cannot be undone. This will permanently delete your chat');
								}}
							/>
						{/each}
					{/if}
				{/each}
			</SidebarMenu>
		</SidebarGroupContent>
	</SidebarGroup>
  <SidebarGroup class="mt-auto">
    <SidebarGroupContent>
      <Button
        variant="ghost"
        class="w-full text-zinc-500 hover:text-red-500"
        onclick={(): void => withConfirmation(handleDeleteAllChats, 'This action cannot be undone. This will permanently delete all of your chats')}
      >
        Delete all chats
      </Button>
    </SidebarGroupContent>
  </SidebarGroup>



{/if}

