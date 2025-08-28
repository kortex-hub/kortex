<script lang="ts">
import { Chat, type UIMessage } from '@ai-sdk/svelte';
import type { Attachment } from '@ai-sdk/ui-utils';
import { untrack } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import { toast } from 'svelte-sonner';

import type { ModelInfo } from '/@/lib/chat/components/model-info';
import { ChatHistory } from '/@/lib/chat/hooks/chat-history.svelte';
import { providerInfos } from '/@/stores/providers';

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

let models: Array<ModelInfo> = $derived(
  $providerInfos.reduce(
    (accumulator, current) => {
      if (current.inferenceConnections.length > 0) {
        for (const { name, models } of current.inferenceConnections) {
          accumulator.push(
            ...models.map(model => ({
              providerId: current.id,
              connectionName: name,
              label: model.label,
            })),
          );
        }
      }
      return accumulator;
    },
    [] as Array<ModelInfo>,
  ),
);

let selectedModel = $state<ModelInfo | undefined>(getFirstModel());
let selectedMCP = new SvelteSet<string>();

function getFirstModel(): ModelInfo | undefined {
  return models && models.length > 0 ? models[0] : undefined;
}

$effect(() => {
  if (!selectedModel && models && models.length > 0) {
    selectedModel = getFirstModel();
  }
});

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
        return Array.from($state.snapshot(selectedMCP).values());
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
</script>

<div class="bg-background flex h-full min-w-0 flex-col">
	<ChatHeader {user} {chat} {readonly} models={models} bind:selectedModel={selectedModel} bind:selectedMCP={selectedMCP} />
 <div class="flex min-h-0 flex-1">
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
         <MultimodalInput {attachments} {user} {chatClient} class="flex-1" />
       {/if}
     </form>
   </div>
		<McpMessages messages={chatClient.messages} />
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
