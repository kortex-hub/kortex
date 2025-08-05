// db.ts or similar
import 'server-only';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, asc, count, desc, eq, gt, gte, inArray, lt, type SQL } from 'drizzle-orm';
import {
  user,
  chat,
  document,
  suggestion,
  message,
  vote,
  stream,
  type User,
  type Suggestion,
  type DBMessage,
  type Chat,
} from './schema';
import type { ArtifactKind } from '@/components/artifact';
import { generateUUID } from '../utils';
import { generateHashedPassword } from './utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../errors';

const sqlite = new Database('sqlite.db');
sqlite.pragma('foreign_keys = ON');
export const db = drizzle(sqlite, {});

await runMigrate(db);

// CRUD functions

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get user by email');
  }
}

import { randomBytes } from 'node:crypto';
import { runMigrate } from './migrate';

function generateSecureRandomId(length = 16) {
  // Generate secure random bytes, then convert to hex string
  return randomBytes(length).toString('hex'); // length bytes → 2*length hex chars
}

export async function createUser(email: string, password: string) {
  const hashed = generateHashedPassword(password);
  const id = generateSecureRandomId();
  try {
    console.log('want to insert user', id, email, hashed);
    const result = await db.insert(user).values({ id, email, password: hashed });
    console.log('result is', result);
    return [{ id, email }];
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());
  const id = generateSecureRandomId();

  try {
    console.log('want to insert guest user', id, email, password);

    const result = await db.insert(user).values({ id, email, password });
    console.log('result is', result);
    return [{ id, email }];
  } catch (error: unknown) {
    console.log('error is', error);
    throw new ChatSDKError('bad_request:database', 'Failed to create guest user');
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    await db.insert(chat).values({ id, userId, title, visibility, createdAt: new Date() });
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));
    const deleted = await db.delete(chat).where(eq(chat.id, id));
    return deleted;
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to delete chat by id');
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter?: string | null;
  endingBefore?: string | null;
}) {
  try {
    const extended = limit + 1;
    const base = (where?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(where ? and(where, eq(chat.userId, id)) : eq(chat.userId, id))
        .orderBy(desc(chat.createdAt))
        .limit(extended);

    let filtered: Chat[] = [];
    if (startingAfter) {
      const [sel] = await db.select().from(chat).where(eq(chat.id, startingAfter)).limit(1);
      if (!sel) throw new ChatSDKError('not_found:database', `Chat ${startingAfter} not found`);
      filtered = await base(gt(chat.createdAt, sel.createdAt));
    } else if (endingBefore) {
      const [sel] = await db.select().from(chat).where(eq(chat.id, endingBefore)).limit(1);
      if (!sel) throw new ChatSDKError('not_found:database', `Chat ${endingBefore} not found`);
      filtered = await base(lt(chat.createdAt, sel.createdAt));
    } else {
      filtered = await base();
    }
    const hasMore = filtered.length > limit;
    return { chats: hasMore ? filtered.slice(0, limit) : filtered, hasMore };
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get chats by user id');
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [chatRow] = await db.select().from(chat).where(eq(chat.id, id));
    return chatRow;
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  // add ids on each message if not present
  const messagesWithIds = messages.map(msg => ({
    ...msg,
    id: msg.id || generateUUID(),
  }));

  try {
    await db.insert(message).values(messagesWithIds);
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.chatId, id)).orderBy(asc(message.createdAt));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get messages by chat id');
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existing] = await db.select().from(vote).where(eq(vote.messageId, messageId));
    if (existing) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    } else {
      await db.insert(vote).values({ chatId, messageId, isUpvoted: type === 'up' });
    }
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get votes by chat id');
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    await db.insert(document).values({ id, title, kind, content, userId, createdAt: new Date() });
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    return await db.select().from(document).where(eq(document.id, id)).orderBy(asc(document.createdAt));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get documents by id');
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [doc] = await db.select().from(document).where(eq(document.id, id)).orderBy(desc(document.createdAt));
    return doc;
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get document by id');
  }
}

export async function deleteDocumentsByIdAfterTimestamp({ id, timestamp }: { id: string; timestamp: Date }) {
  try {
    await db.delete(suggestion).where(and(eq(suggestion.documentId, id), gt(suggestion.documentCreatedAt, timestamp)));
    return await db.delete(document).where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to delete documents by id after timestamp');
  }
}

export async function saveSuggestions({ suggestions }: { suggestions: Suggestion[] }) {
  try {
    await db.insert(suggestion).values(suggestions);
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to save suggestions');
  }
}

export async function getSuggestionsByDocumentId({ documentId }: { documentId: string }) {
  try {
    return await db.select().from(suggestion).where(eq(suggestion.documentId, documentId));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get suggestions by document id');
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get message by id');
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({ chatId, timestamp }: { chatId: string; timestamp: Date }) {
  try {
    const toDel = await db
      .select({ id: message.id })
      .from(message)
      .where(and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)));
    const ids = toDel.map(m => m.id);
    if (ids.length) {
      await db.delete(vote).where(and(eq(vote.chatId, chatId), inArray(vote.messageId, ids)));
      return await db.delete(message).where(and(eq(message.chatId, chatId), inArray(message.id, ids)));
    }
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to delete messages by chat id after timestamp');
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to update chat visibility by id');
  }
}

export async function getMessageCountByUserId({ id, differenceInHours }: { id: string; differenceInHours: number }) {
  try {
    const cutoff = new Date(Date.now() - differenceInHours * 3600 * 1000);
    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(and(eq(chat.userId, id), gte(message.createdAt, cutoff), eq(message.role, 'user')));
    return stats?.count ?? 0;
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get message count by user id');
  }
}

export async function createStreamId({ streamId, chatId }: { streamId: string; chatId: string }) {
  try {
    await db.insert(stream).values({ id: streamId, chatId, createdAt: new Date() });
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to create stream id');
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const rows = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt));
    return rows.map(r => r.id);
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get stream ids by chat id');
  }
}
