// Hack to import libsql in electron
import { createRequire } from 'node:module';
import { join } from 'node:path';

import type { LanguageModelV2Usage } from '@ai-sdk/provider';
import type { ResultSet } from '@libsql/client';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

import { Directories } from '/@/plugin/directories.js';

import type { DBChat, DBMessage } from './schema.js';
import { chat, message } from './schema.js';

const require = createRequire(import.meta.url);
const { createClient } = require('@libsql/client/sqlite3');

const client = createClient({ url: `file:${join(new Directories().getConfigurationDirectory(), 'local.db')}` });

const db = drizzle(client);

const runMigrate = async (): Promise<void> => {
  console.log('⏳ Running migrations...');

  const start = Date.now();
  await migrate(db, { migrationsFolder: './packages/main/src/chat/db/migrations/' });
  const end = Date.now();

  console.log('✅ Migrations completed in', end - start, 'ms');
};

runMigrate().catch((err: unknown) => {
  console.error('❌ Migration failed');
  console.error(err);
  process.exit(1);
});

export async function saveChat({ chatId, title }: { chatId: string; title: string }): Promise<ResultSet> {
  try {
    return await db.insert(chat).values({
      id: chatId,
      createdAt: new Date(),
      title,
    });
  } catch (error) {
    throw new Error('bad_request:database: Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }): Promise<DBChat | undefined> {
  try {
    await db.delete(message).where(eq(message.chatId, id));

    const [chatsDeleted] = await db.delete(chat).where(eq(chat.id, id)).returning();
    return chatsDeleted;
  } catch (error) {
    throw new Error('bad_request:database: Failed to delete chat by id');
  }
}

export async function getChats(): Promise<DBChat[]> {
  try {
    const chats = await db.select().from(chat).orderBy(asc(chat.createdAt)).limit(200);
    return chats;
  } catch (error) {
    throw new Error('bad_request:database: Failed to get chats');
  }
}

export async function getChatById({ chatId }: { chatId: string }): Promise<DBChat | null> {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, chatId));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (error) {
    throw new Error('bad_request:database: Failed to get chat by id');
  }
}

export async function saveMessages({ messages }: { messages: Array<DBMessage> }): Promise<ResultSet> {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    throw new Error('bad_request:database: Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }): Promise<DBMessage[]> {
  try {
    return await db.select().from(message).where(eq(message.chatId, id)).orderBy(asc(message.createdAt));
  } catch (error) {
    throw new Error('bad_request:database: Failed to get messages by chat id');
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  // Store raw LanguageModelUsage to keep it simple
  context: LanguageModelV2Usage;
}): Promise<ResultSet> {
  try {
    return await db.update(chat).set({ lastContext: context }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new Error('bad_request:database: failed to update lastContext for chat');
  }
}
