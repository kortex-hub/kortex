import type { LanguageModelV2Usage } from '@ai-sdk/provider';
import type { InferSelectModel } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const chat = sqliteTable('Chat', {
  id: text('id').primaryKey().notNull(),
  createdAt: text('createdAt').notNull(),
  title: text('title').notNull(),
  lastContext: text('lastContext').$type<LanguageModelV2Usage | null>(),
});

export type DBChat = InferSelectModel<typeof chat>;

export const message = sqliteTable('Message', {
  id: text('id').primaryKey().notNull(),
  chatId: text('chatId')
    .notNull()
    .references(() => chat.id),
  role: text('role').notNull(),
  parts: text('parts').notNull(),
  createdAt: text('createdAt').notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;
