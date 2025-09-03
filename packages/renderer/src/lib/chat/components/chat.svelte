<script lang="ts">
import { Chat, type UIMessage } from '@ai-sdk/svelte';
import type { Attachment } from '@ai-sdk/ui-utils';
import { Button } from '@podman-desktop/ui-svelte';
import { untrack } from 'svelte';
import { toast } from 'svelte-sonner';
import { router } from 'tinro';

import type { ModelInfo } from '/@/lib/chat/components/model-info';
import { ChatHistory } from '/@/lib/chat/hooks/chat-history.svelte';
import { getModels } from '/@/lib/models/models-utils';
import { providerInfos } from '/@/stores/providers';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';

import type { Chat as DbChat, User } from '../../../../../main/src/chat/db/schema';
import ChatHeader from './chat-header.svelte';
import { IPCChatTransport } from './ipc-chat-transport';
import McpMessages from './mcp-messages.svelte';
import Messages from './messages.svelte';
import MultimodalInput from './multimodal-input.svelte';

let {
  user,
  chat,
  readonly,
  initialMessages,
}: {
  user: User | undefined;
  chat: DbChat | undefined;
  initialMessages: UIMessage[];
  readonly: boolean;
} = $props();

let models: Array<ModelInfo> = $derived(getModels($providerInfos));

let selectedModel = $derived<ModelInfo | undefined>(models[0]);
let selectedMCP = $state<MCPRemoteServerInfo[]>([]);

const chatHistory = ChatHistory.fromContext();

const chatClient = $derived(
  new Chat({
    id: chat?.id,
    transport: new IPCChatTransport({
      getModel: (): ModelInfo => {
        const value = $state.snapshot(selectedModel);
        if (!value) throw new Error('no model selected');
        return value;
      },
      getMCP: (): Array<string> => {
        return selectedMCP.map(m => m.id);
      },
    }),
    // This way, the client is only recreated when the ID changes, allowing us to fully manage messages
    // clientside while still SSRing them on initial load or when we navigate to a different chat.
    messages: untrack(() => initialMessages),
    generateId: crypto.randomUUID.bind(crypto),
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    onFinish: async (): Promise<void> => {
      await chatHistory.refetch();
    },
    onError: (error): void => {
      try {
        // If there's an API error, its message will be JSON-formatted
        const jsonError = JSON.parse(error.message);
        console.log(jsonError);
        if (
          typeof jsonError === 'object' &&
          jsonError !== null &&
          'message' in jsonError &&
          typeof jsonError.message === 'string'
        ) {
          toast.error(jsonError.message);
        } else {
          toast.error(error.message);
        }
      } catch {
        toast.error(error.message);
      }
    },
  }),
);

let attachments = $state<Attachment[]>([]);
let mcpSelectorOpen = $state(false);

const hasModels = $derived(models && models.length > 0);
</script>

<div class="bg-background flex h-full min-w-0 flex-col">
  {#if hasModels}
	  <ChatHeader {user} bind:mcpSelectorOpen={mcpSelectorOpen} {chat} {readonly} models={models} bind:selectedModel={selectedModel} bind:selectedMCP={selectedMCP} />
  {/if}
  <div class="flex min-h-0 flex-1">
        {#if hasModels}
            <div class="flex flex-col flex-3/4"> 
                <Messages
                    {readonly}
                    loading={chatClient.status === 'streaming' || chatClient.status === 'submitted'}
                    messages={chatClient.messages}
                    {selectedModel}
                    {selectedMCP}
                />
                <form class="bg-background mx-auto flex w-full gap-2 px-4 pb-4 md:max-w-3xl md:pb-6">
                    {#if !readonly}
                        <MultimodalInput {attachments} {chatClient} {selectedMCP} bind:mcpSelectorOpen={mcpSelectorOpen} class="flex-1" />
                    {/if}
                </form>
            </div>
            <McpMessages messages={chatClient.messages} />
        {:else}
            <div class="flex flex-col items-center justify-center w-full p-8 text-center">
                <h2 class="text-2xl font-semibold mb-4">No AI Models Available</h2>
                <p class="text-muted-foreground mb-6">You need to configure at least one AI model to start chatting.</p>
                <Button onclick={():void => router.goto('/preferences/resources')}>
                    Configure Models
                </Button>
            </div>
        {/if}
    </div>
</div>

<!-- TODO -->
<!-- <Artifact
	chatId={id}
	{input}
	{setInput}
	{handleSubmit}
	{isLoading}
	{stop}
	{attachments}
	{setAttachments}
	{append}
	{messages}
	{setMessages}
	{reload}
	{votes}
	{readonly}
/> -->
