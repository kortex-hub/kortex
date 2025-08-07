import type { ChatRequestOptions, ChatTransport, UIMessage, UIMessageChunk } from 'ai';

export class IPCChatTransport<T extends UIMessage> implements ChatTransport<T> {
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

    // Buffer to collect chunks
    const chunks: UIMessageChunk[] = [];

    try {
      await window.inferenceStreamText(
        'gemini-2.0-flash-lite',
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
