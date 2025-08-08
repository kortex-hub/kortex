<script lang="ts">
import { Chat, type UIMessage } from '@ai-sdk/svelte';
import type { Attachment } from '@ai-sdk/ui-utils';
import { untrack } from 'svelte';
import { toast } from 'svelte-sonner';

import type { ModelInfo } from '/@/lib/chat/components/model-info';
import { ChatHistory } from '/@/lib/chat/hooks/chat-history.svelte';
import {providerInfos} from '/@/stores/providers';

import type { Chat as DbChat, User } from '../../../../../main/src/chat/db/schema';
import ChatHeader from './chat-header.svelte';
import { IPCChatTransport } from './ipc-chat-transport';
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

function getFirstModel(): ModelInfo | undefined {
  const inference = $providerInfos.find((provider) => provider.inferenceConnections.length > 0);
  if (!inference) return undefined;

  const connection = inference.inferenceConnections.find((connection) => connection.models.length > 0);
  if (!connection) return undefined;

  return {
    internalProviderId: inference.internalId,
    connectionName: connection.name,
    label: connection.models[0].label,
  };
}

let selectedModel = $state<ModelInfo | undefined>(getFirstModel());

let models: Array<ModelInfo> = $derived(
  $providerInfos.reduce((accumulator, current) => {
    if (current.inferenceConnections.length > 0) {

      for (const { name, models } of current.inferenceConnections) {
        accumulator.push(...models.map(model => ({
          internalProviderId: current.internalId,
          connectionName: name,
          label: model.label,
        })));
      }
    }
    return accumulator;
  }, [] as Array<ModelInfo>),
);

const chatHistory = ChatHistory.fromContext();

const chatClient = $derived(
  new Chat({
    id: chat?.id,
    transport: new IPCChatTransport(() => {
      const value = $state.snapshot(selectedModel);
      if(!value) throw new Error('no model selected');
      return value;
    }),
    // This way, the client is only recreated when the ID changes, allowing us to fully manage messages
    // clientside while still SSRing them on initial load or when we navigate to a different chat.
    messages: untrack(() => initialMessages),
    generateId: crypto.randomUUID.bind(crypto),
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
	<ChatHeader {user} {chat} {readonly} models={models} bind:selectedModel={selectedModel} />
	<Messages
		{readonly}
		loading={chatClient.status === 'streaming' || chatClient.status === 'submitted'}
		messages={chatClient.messages}
	/>

	<form class="bg-background mx-auto flex w-full gap-2 px-4 pb-4 md:max-w-3xl md:pb-6">
		{#if !readonly}
			<MultimodalInput {attachments} {user} {chatClient} class="flex-1" models={models} />
		{/if}
	</form>
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
