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

interface Props {
  chatId?: string;
}

const { chatId }: Props = $props();

const chatPromise = $derived(chatId ? window.inferenceGetChatById(chatId) : undefined);

// set default user
const data = { chats: window.inferenceGetChats(), sidebarCollapsed: true };
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
	<AppSidebar />
	<SidebarInset>
    {#await chatPromise}
    Loading
    {:then chat} 
      <Chat chat={chat ?? undefined} initialMessages={[]} readonly={false}  />
    {/await}
</SidebarInset>
</SidebarProvider>

</ThemeProvider>
</div>
{/if}

