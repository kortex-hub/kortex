import type { Attachment } from '@ai-sdk/ui-utils';
import type { AssistantModelMessage, FileUIPart, ToolModelMessage, UIMessage } from 'ai';

import type { Document, Message } from '/@api/chat/schema.js';

export function convertToUIMessages(messages: Array<Message>): Array<UIMessage> {
  return messages.map(message => ({
    id: message.id,
    parts: message.parts as UIMessage['parts'],
    role: message.role as UIMessage['role'],
    // Note: content will soon be deprecated in @ai-sdk/react
    content: '',
    createdAt: message.createdAt,
    experimental_attachments: (message.attachments as Array<Attachment>) ?? [],
    tokens: message.tokens,
  }));
}

export function getMostRecentUserMessage(messages: Array<UIMessage>): UIMessage | undefined {
  const userMessages = messages.filter(message => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(documents: Array<Document>, index: number): Date {
  if (!documents) {
    return new Date();
  }
  if (index > documents.length) {
    return new Date();
  }

  return documents[index].createdAt;
}

type ResponseMessageWithoutId = ToolModelMessage | AssistantModelMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function getTrailingMessageId({ messages }: { messages: Array<ResponseMessage> }): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) {
    return null;
  }

  return trailingMessage.id;
}

export function fileUIPart2Attachment(part: FileUIPart): Attachment {
  return {
    name: part.filename ?? part.url.substring(part.url.lastIndexOf('/') + 1),
    contentType: part.mediaType,
    url: part.url,
  };
}
