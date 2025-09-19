<script lang="ts">
import { ThemeProvider } from '@sejohnson/svelte-themes';
import { onMount } from 'svelte';

import AppSidebar from '/@/lib/chat/components/app-sidebar.svelte';
import Chat from '/@/lib/chat/components/chat.svelte';
import { SidebarInset, SidebarProvider } from '/@/lib/chat/components/ui/sidebar';
import { Toaster } from '/@/lib/chat/components/ui/sonner';
import { ChatHistory } from '/@/lib/chat/hooks/chat-history.svelte.js';

import { DEFAULT_CHAT_MODEL } from '../ai/models';
import { SelectedModel } from '../hooks/selected-model.svelte';
import { convertToUIMessages } from '../utils/chat';

interface Props {
  chatId?: string;
}
const { chatId }: Props = $props();

const data = { chats: window.inferenceGetChats(), sidebarCollapsed: true, user: { id: 'Guest', email: 'Guest' } };

const chatMessagesPromise = $derived(chatId ? window.inferenceGetChatMessagesById(chatId) : undefined);

const chatHistory = new ChatHistory(data.chats);
chatHistory.setContext();

let selectedChatModel: SelectedModel | undefined = $state(undefined);

onMount(() => {
  // define select model to be the default chat model
  selectedChatModel = new SelectedModel(DEFAULT_CHAT_MODEL);
  selectedChatModel.setContext();
});
</script>

{#if selectedChatModel}
<div class="flex h-full w-full">
<ThemeProvider attribute="class" disableTransitionOnChange >

	<Toaster position="top-center" />

<SidebarProvider open={!data.sidebarCollapsed}>
	<AppSidebar user={data.user} {chatId} />
	<SidebarInset>
    {#await chatMessagesPromise}
      Loading
    {:then chatMessages} 
      <Chat chat={chatMessages?.chat ?? undefined} initialMessages={chatMessages?.messages ? convertToUIMessages(chatMessages.messages): []} user={data.user} readonly={false}  />
    {/await}
</SidebarInset>
</SidebarProvider>

</ThemeProvider>
</div>
{/if}

