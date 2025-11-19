<script lang="ts">
import { Chat } from '@ai-sdk/svelte';
import type { Attachment } from '@ai-sdk/ui-utils';
import { untrack } from 'svelte';
import { toast } from 'svelte-sonner';

import type { ModelInfo } from '/@/lib/chat/components/model-info';
import { ChatHistory } from '/@/lib/chat/hooks/chat-history.svelte';
import { convertToUIMessages } from '/@/lib/chat/utils/chat';
import { getModels } from '/@/lib/models/models-utils';
import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';
import { providerInfos } from '/@/stores/providers';
import { MessageConfigSchema } from '/@api/chat/message-config';
import type { Chat as DbChat, Message as DbMessage } from '/@api/chat/schema.js';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';

import ChatHeader from './chat-header.svelte';
import { IPCChatTransport } from './ipc-chat-transport';
import McpMessages from './mcp-messages.svelte';
import Messages from './messages.svelte';
import MultimodalInput from './multimodal-input.svelte';
import NoModelsAvailable from './NoModelsAvailable.svelte';

let {
  chat,
  readonly,
  messages,
}: {
  chat: DbChat | undefined;
  messages: DbMessage[];
  readonly: boolean;
} = $props();

let models: Array<ModelInfo> = $derived(getModels($providerInfos));

const config = MessageConfigSchema.safeParse(messages[messages.length - 1]?.config).data;

let selectedModel = $derived<ModelInfo | undefined>(
  config
    ? {
        connectionName: config.connectionName,
        label: config.modelId,
        providerId: config.providerId,
      }
    : models[0],
);

let selectedMCP = $state<MCPRemoteServerInfo[]>(
  config?.mcp?.flatMap(mcpId => $mcpRemoteServerInfos.find(r => r.id === mcpId) ?? []) ?? [],
);

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
    messages: untrack(() => convertToUIMessages(messages)),
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
	  <ChatHeader bind:mcpSelectorOpen={mcpSelectorOpen} {readonly} models={models} bind:selectedModel={selectedModel} bind:selectedMCP={selectedMCP} />
  {/if}
  <div class="flex min-h-0 flex-1">
        {#if hasModels}
            <div class="flex flex-col flex-3/4">
                <Messages
                    {readonly}
                    loading={chatClient.status === 'streaming' || chatClient.status === 'submitted'}
                    messages={chatClient.messages}
                />
                <form class="bg-background mx-auto flex w-full gap-2 px-4 pb-4 md:max-w-3xl md:pb-6">
                    {#if !readonly}
                        <MultimodalInput {attachments} {chatClient} {selectedModel} {selectedMCP} bind:mcpSelectorOpen={mcpSelectorOpen} class="flex-1" />
                    {/if}
                </form>
            </div>
            <McpMessages messages={chatClient.messages} />
        {:else}
            <NoModelsAvailable />
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
