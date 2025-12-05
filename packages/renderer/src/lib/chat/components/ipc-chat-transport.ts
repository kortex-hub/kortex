import type { ChatRequestOptions, ChatTransport, UIMessage, UIMessageChunk } from 'ai';

import type { ModelInfo } from '/@/lib/chat/components/model-info';

import { currentChatId } from '../state/current-chat-id.svelte.js';

interface Dependencies {
  getModel: () => ModelInfo;
  getMCPTools: () => Record<string, Array<string>>;
}

export class IPCChatTransport<T extends UIMessage> implements ChatTransport<T> {
  constructor(private readonly dependencies: Dependencies) {}

  async sendMessages(
    options: {
      trigger: 'submit-message' | 'regenerate-message';
      chatId: string;
      messageId: string | undefined;
      messages: T[];
      abortSignal: AbortSignal | undefined;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk>> {
    const uiMessages = JSON.parse(JSON.stringify(options.messages));
    const model = this.dependencies.getModel();
    console.log('Selected model', model);

    const tools = this.dependencies.getMCPTools();

    return new ReadableStream<UIMessageChunk>({
      async start(controller): Promise<void> {
        const { providerId, connectionName, label } = model;
        await window.inferenceStreamText(
          {
            chatId: options.chatId,
            providerId,
            connectionName,
            modelId: label,
            tools,
            messages: uiMessages,
          },
          (chunk: UIMessageChunk) => {
            console.log('IPCChatTransport->chunk:', chunk);
            controller.enqueue(chunk);
          },
          (error: unknown) => {
            console.error('Error during inferenceStreamText:', error);
            controller.error(error);
          },
          () => {
            console.log('IPCChatTransport: Stream completed');
            controller.close();
          },
        );
        currentChatId.value = options.chatId;
      },
    });
  }

  reconnectToStream(options: { chatId: string } & ChatRequestOptions): Promise<ReadableStream<UIMessageChunk> | null> {
    //FIX ME: not implemented
    console.log('reconnecting to stream with options', options);
    return Promise.resolve(null);
  }
}
