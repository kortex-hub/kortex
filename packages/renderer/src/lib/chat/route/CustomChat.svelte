<script lang="ts">
import { ThemeProvider } from '@sejohnson/svelte-themes';
import { onDestroy } from 'svelte';

import AppSidebar from '/@/lib/chat/components/app-sidebar.svelte';
import Chat from '/@/lib/chat/components/chat.svelte';
import { SidebarInset, SidebarProvider } from '/@/lib/chat/components/ui/sidebar';
import { Toaster } from '/@/lib/chat/components/ui/sonner';
import { ChatHistory } from '/@/lib/chat/hooks/chat-history.svelte.js';
import { currentChatId } from '/@/lib/chat/state/current-chat-id.svelte';
import { sidebarCollapsed } from '/@/lib/chat/state/sidebar-collapsed.svelte';
import { isDark } from '/@/stores/appearance';

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

onDestroy(() => chatHistory.dispose());

// Sync the chat's ThemeProvider with the app's appearance setting
const forcedTheme = $derived($isDark ? 'dark' : 'light');
</script>

<div class="flex h-full w-full">
<ThemeProvider attribute="class" disableTransitionOnChange {forcedTheme}>
	<Toaster position="top-center" />
  {#await chatMessagesPromise}
    Loading
  {:then { chat, messages }}
    <SidebarProvider open={!sidebarCollapsed.value} onOpenChange={(open: boolean): boolean => sidebarCollapsed.value = !open}>
      <AppSidebar {chatId} />
      <SidebarInset>
        <Chat {chat} {messages} readonly={false} />
      </SidebarInset>
    </SidebarProvider>
  {/await}
</ThemeProvider>
</div>

