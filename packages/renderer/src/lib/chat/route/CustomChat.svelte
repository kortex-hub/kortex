<script lang="ts">
	import { ThemeProvider } from '@sejohnson/svelte-themes';
	import { Toaster } from '/@/lib/chat/components/ui/sonner';
  import Chat from '/@/lib/chat/components/chat.svelte';
  import { onMount } from 'svelte';
	import AppSidebar from '/@/lib/chat/components/app-sidebar.svelte';
	import { SidebarInset, SidebarProvider } from '/@/lib/chat/components/ui/sidebar';
	import { ChatHistory } from '/@/lib/chat/hooks/chat-history.svelte.js';
  import { SelectedModel } from '../hooks/selected-model.svelte';
  import { DEFAULT_CHAT_MODEL } from '../ai/models';


  // set default user
  const data = {chats: Promise.resolve([]),  sidebarCollapsed: true, user: {id: 'Guest', email: 'Guest'}};
	const chatHistory = new ChatHistory(data.chats);
	chatHistory.setContext();


  let selectedChatModel: SelectedModel | undefined = undefined;

onMount(() => {

  // define select model to be the default chat model
 selectedChatModel = new SelectedModel(DEFAULT_CHAT_MODEL)
  selectedChatModel.setContext();

})

</script>

{#if selectedChatModel}
<div class="flex h-full w-full">
<ThemeProvider attribute="class" disableTransitionOnChange >

	<Toaster position="top-center" />

<SidebarProvider open={!data.sidebarCollapsed}>
	<AppSidebar user={data.user} />
	<SidebarInset>
    <Chat chat={undefined} initialMessages={[]} readonly={false} user={data.user} />
</SidebarInset>
</SidebarProvider>

</ThemeProvider>
</div>
{/if}

