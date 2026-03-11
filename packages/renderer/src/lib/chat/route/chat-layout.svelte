<script lang="ts">
import { onDestroy } from 'svelte';

import AppSidebar from '/@/lib/chat/components/app-sidebar.svelte';
import { SidebarInset, SidebarProvider } from '/@/lib/chat/components/ui/sidebar';
import { ChatHistory } from '/@/lib/chat/hooks/chat-history.svelte.js';

let { data, children } = $props();

const chatHistory = new ChatHistory(data.chats);
chatHistory.setContext();
data.selectedChatModel.setContext();

onDestroy(() => chatHistory.dispose());
</script>

<SidebarProvider open={!data.sidebarCollapsed}>
	<AppSidebar />
	<SidebarInset>{@render children?.()}</SidebarInset>
</SidebarProvider>
