import type { InferSelectModel } from 'drizzle-orm';
import { sqliteTable, text, primaryKey, foreignKey, integer } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('User', {
  id: text('id').primaryKey().notNull(),
  email: text('email', { length: 64 }).notNull(),
  password: text('password', { length: 64 }),
});

export type User = InferSelectModel<typeof user>;

export const chat = sqliteTable('Chat', {
  id: text('id').primaryKey().notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  title: text('title').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  visibility: text('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = sqliteTable('Message', {
  id: text('id').primaryKey().notNull(),
  chatId: text('chatId')
    .notNull()
    .references(() => chat.id),
  role: text('role').notNull(),
  content: text('content', { mode: 'json' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = sqliteTable('Message_v2', {
  id: text('id').primaryKey().notNull(),
  chatId: text('chatId')
    .notNull()
    .references(() => chat.id),
  role: text('role').notNull(),
  parts: text('parts', { mode: 'json' }).notNull(),
  attachments: text('attachments', { mode: 'json' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = sqliteTable(
  'Vote',
  {
    chatId: text('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: text('messageId')
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: integer('isUpvoted', { mode: 'boolean' }).notNull(),
  },
  table => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = sqliteTable(
  'Vote_v2',
  {
    chatId: text('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: text('messageId')
      .notNull()
      .references(() => message.id),
    isUpvoted: integer('isUpvoted', { mode: 'boolean' }).notNull(),
  },
  table => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

export const document = sqliteTable(
  'Document',
  {
    id: text('id').notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: text('text', { enum: ['text', 'code', 'image', 'sheet'] })
      .notNull()
      .default('text'),
    userId: text('userId')
      .notNull()
      .references(() => user.id),
  },
  table => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  },
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = sqliteTable(
  'Suggestion',
  {
    id: text('id').notNull(),
    documentId: text('documentId').notNull(),
    documentCreatedAt: integer('documentCreatedAt', {
      mode: 'timestamp',
    }).notNull(),
    originalText: text('originalText').notNull(),
    suggestedText: text('suggestedText').notNull(),
    description: text('description'),
    isResolved: integer('isResolved', { mode: 'boolean' }).notNull().default(false),
    userId: text('userId')
      .notNull()
      .references(() => user.id),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  },
  table => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  }),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = sqliteTable(
  'Stream',
  {
    id: text('id').notNull(),
    chatId: text('chatId').notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  },
  table => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  }),
);

export type Stream = InferSelectModel<typeof stream>;
