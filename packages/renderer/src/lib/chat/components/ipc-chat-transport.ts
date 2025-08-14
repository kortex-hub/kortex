import type { ChatRequestOptions, ChatTransport, UIMessage, UIMessageChunk } from 'ai';

import type { ModelInfo } from '/@/lib/chat/components/model-info';

interface Dependencies {
  getModel: () => ModelInfo;
  getMCP: () => Array<string>;
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

    console.log('IPCChatTransport: uiMessages', uiMessages);
    const model = this.dependencies.getModel();
    console.log('Selected model', model);

    // Buffer to collect chunks
    const chunks: UIMessageChunk[] = [];

    try {
      await window.inferenceStreamText(
        model.providerId,
        model.connectionName,
        model.label,
        this.dependencies.getMCP(),
        uiMessages,
        (chunk: UIMessageChunk) => {
          console.log('IPCChatTransport->chunk:', chunk);
          chunks.push(chunk);
        },
        (error: unknown) => {
          throw error;
        },
        () => {
          console.log('IPCChatTransport:Stream completed');
        },
      );
    } catch (error) {
      console.error('Error during inferenceStreamText:', error);
    }

    // Now create a stream from the buffered chunks
    return new ReadableStream<UIMessageChunk>({
      start(controller): void {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
  }

  reconnectToStream(options: { chatId: string } & ChatRequestOptions): Promise<ReadableStream<UIMessageChunk> | null> {
    //FIXME: not implemented
    console.log('reconnecting to stream with options', options);
    return Promise.resolve(null);
  }
}
