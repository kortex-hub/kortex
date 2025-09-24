<script lang="ts">
import { ThemeProvider } from '@sejohnson/svelte-themes';
import { onMount } from 'svelte';

import AppSidebar from '/@/lib/chat/components/app-sidebar.svelte';
import Chat from '/@/lib/chat/components/chat.svelte';
import { SidebarInset, SidebarProvider } from '/@/lib/chat/components/ui/sidebar';
import { Toaster } from '/@/lib/chat/components/ui/sonner';
import { ChatHistory } from '/@/lib/chat/hooks/chat-history.svelte.js';
import { currentChatId } from '/@/lib/chat/stores/current-chat-id.svelte.js';
import { sidebarCollapsed } from '/@/lib/chat/stores/sidebar-collapsed';

import { DEFAULT_CHAT_MODEL } from '../ai/models';
import { SelectedModel } from '../hooks/selected-model.svelte';
import { convertToUIMessages } from '../utils/chat';

interface Props {
  chatId?: string;
}
const { chatId: routerChatId }: Props = $props();

const chatId = $derived(routerChatId ?? currentChatId.value);

const chatsPromise = window.inferenceGetChats();
const chatHistory = new ChatHistory(chatsPromise);
chatHistory.setContext();

const chatMessagesPromise = $derived(
  chatId ? window.inferenceGetChatMessagesById(chatId) : Promise.resolve({ chat: undefined, messages: [] }),
);

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
  {#await chatMessagesPromise}
    Loading
  {:then { chat, messages }} 
    <SidebarProvider open={!$sidebarCollapsed} onOpenChange={(open: boolean): void => sidebarCollapsed.set(!open)}>
      <AppSidebar {chatId} />
      <SidebarInset>
        <Chat {chat} initialMessages={convertToUIMessages(messages)} readonly={false} />
      </SidebarInset>
    </SidebarProvider>
  {/await}
</ThemeProvider>
</div>
{/if}

