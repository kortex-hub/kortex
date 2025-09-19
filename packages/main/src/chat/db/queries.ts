import { randomBytes } from 'node:crypto';

import { genSaltSync, hashSync } from 'bcrypt-ts';
import { and, asc, desc, eq, gt, gte, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import ms from 'ms';
import type { ResultAsync } from 'neverthrow';
import { fromPromise, ok, safeTry } from 'neverthrow';

import type { DbError } from '/@api/chat/errors/db.js';
import { DbInternalError } from '/@api/chat/errors/db.js';

import {
  type AuthUser,
  type Chat,
  chat,
  document,
  type Message,
  message,
  type Session,
  session,
  type Suggestion,
  suggestion,
  type User,
  user,
  type Vote,
  vote,
} from './schema.js';
import { unwrapSingleQueryResult } from './utils.js';

interface DbDocument {
  id: string;
  createdAt: Date;
  title: string;
  content: string | null;
  kind: 'text' | 'code' | 'image' | 'sheet';
  userId: string;
}

function generateSecureRandomId(length = 16): string {
  // Generate secure random bytes, then convert to hex string
  return randomBytes(length).toString('hex'); // length bytes → 2*length hex chars
}

export class ChatQueries {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  getAuthUser = (email: string): ResultAsync<AuthUser, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      const userResult = yield* fromPromise(
        db.select().from(user).where(eq(user.email, email)),
        e => new DbInternalError({ cause: e }),
      );
      return unwrapSingleQueryResult(userResult, email, 'User');
    });
  };

  getUser = (email: string): ResultAsync<User, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      const userResult = yield* fromPromise(
        db.select().from(user).where(eq(user.email, email)),
        e => new DbInternalError({ cause: e }),
      );
      // password is intentionally not used
      // eslint-disable-next-line sonarjs/no-unused-vars, @typescript-eslint/no-unused-vars
      const { password: _, ...rest } = yield* unwrapSingleQueryResult(userResult, email, 'User');

      return ok(rest);
    });
  };

  createAuthUser = (email: string, password: string): ResultAsync<AuthUser, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      const salt = genSaltSync(10);
      const hash = hashSync(password, salt);
      const id = generateSecureRandomId();

      const userResult = yield* fromPromise(db.insert(user).values({ id, email, password: hash }).returning(), e => {
        console.error(e);
        return new DbInternalError({ cause: e });
      });

      return unwrapSingleQueryResult(userResult, email, 'User');
    });
  };

  createSession = (value: Session): ResultAsync<Session, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      const sessionResult = yield* fromPromise(
        db.insert(session).values(value).returning(),
        e => new DbInternalError({ cause: e }),
      );
      return unwrapSingleQueryResult(sessionResult, value.id, 'Session');
    });
  };

  getFullSession = (sessionId: string): ResultAsync<{ session: Session; user: User }, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      const sessionResult = yield* fromPromise(
        db
          .select({ user: { id: user.id, email: user.email }, session })
          .from(session)
          .innerJoin(user, eq(session.userId, user.id))
          .where(eq(session.id, sessionId)),
        e => new DbInternalError({ cause: e }),
      );
      return unwrapSingleQueryResult(sessionResult, sessionId, 'Session');
    });
  };

  deleteSession = (sessionId: string): ResultAsync<undefined, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      yield* fromPromise(db.delete(session).where(eq(session.id, sessionId)), e => new DbInternalError({ cause: e }));

      return ok(undefined);
    });
  };

  extendSession = (sessionId: string): ResultAsync<Session, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      const sessionResult = yield* fromPromise(
        db
          .update(session)
          .set({ expiresAt: new Date(Date.now() + ms('30d')) })
          .where(eq(session.id, sessionId))
          .returning(),
        e => new DbInternalError({ cause: e }),
      );

      return unwrapSingleQueryResult(sessionResult, sessionId, 'Session');
    });
  };

  deleteSessionsForUser = (userId: string): ResultAsync<undefined, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      yield* fromPromise(db.delete(session).where(eq(session.userId, userId)), e => new DbInternalError({ cause: e }));

      return ok(undefined);
    });
  };

  saveChat = ({ id, userId, title }: { id: string; userId: string; title: string }): ResultAsync<Chat, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      const insertResult = yield* fromPromise(
        db
          .insert(chat)
          .values({
            id,
            createdAt: new Date(),
            userId,
            title,
          })
          .returning(),
        e => new DbInternalError({ cause: e }),
      );

      return unwrapSingleQueryResult(insertResult, id, 'Chat');
    });
  };

  deleteChatById = ({ id }: { id: string }): ResultAsync<undefined, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      const actions: Array<() => Promise<unknown>> = [
        (): Promise<unknown> => db.delete(vote).where(eq(vote.chatId, id)),
        (): Promise<unknown> => db.delete(message).where(eq(message.chatId, id)),
        (): Promise<unknown> => db.delete(chat).where(eq(chat.id, id)),
      ];

      for (const action of actions) {
        yield* fromPromise(action(), e => new DbInternalError({ cause: e }));
      }

      return ok(undefined);
    });
  };

  getChatsByUserId = ({ id }: { id: string }): ResultAsync<Chat[], DbError> => {
    return fromPromise(
      this.db.select().from(chat).where(eq(chat.userId, id)).orderBy(desc(chat.createdAt)),
      e => new DbInternalError({ cause: e }),
    );
  };

  getChatById = ({ id }: { id: string }): ResultAsync<Chat, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      const chatResult = yield* fromPromise(
        db.select().from(chat).where(eq(chat.id, id)),
        e => new DbInternalError({ cause: e }),
      );
      return unwrapSingleQueryResult(chatResult, id, 'Chat');
    });
  };

  saveMessages = ({ messages }: { messages: Array<Message> }): ResultAsync<Message[], DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      const insertResult = yield* fromPromise(
        db.insert(message).values(messages).returning(),
        e => new DbInternalError({ cause: e }),
      );

      return ok(insertResult);
    });
  };

  getMessagesByChatId = ({ id }: { id: string }): ResultAsync<Message[], DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      const messages = yield* fromPromise(
        db.select().from(message).where(eq(message.chatId, id)).orderBy(asc(message.createdAt)),
        e => new DbInternalError({ cause: e }),
      );

      return ok(messages);
    });
  };

  voteMessage = ({
    chatId,
    messageId,
    type,
  }: {
    chatId: string;
    messageId: string;
    type: 'up' | 'down';
  }): ResultAsync<undefined, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      yield* fromPromise(
        db
          .insert(vote)
          .values({
            chatId,
            messageId,
            isUpvoted: type === 'up',
          })
          .onConflictDoUpdate({
            target: [vote.messageId, vote.chatId],
            set: { isUpvoted: type === 'up' },
          }),
        e => new DbInternalError({ cause: e }),
      );
      return ok(undefined);
    });
  };

  getVotesByChatId = ({ id }: { id: string }): ResultAsync<Vote[], DbError> => {
    return fromPromise(this.db.select().from(vote).where(eq(vote.chatId, id)), e => new DbInternalError({ cause: e }));
  };

  saveDocument = async ({
    id,
    title,
    kind,
    content,
    userId,
  }: {
    id: string;
    title: string;
    kind: never;
    content: string;
    userId: string;
  }): Promise<unknown> => {
    try {
      return await this.db.insert(document).values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to save document in database');
      throw error;
    }
  };

  getDocumentsById = async ({ id }: { id: string }): Promise<DbDocument[]> => {
    try {
      const documents = await this.db
        .select()
        .from(document)
        .where(eq(document.id, id))
        .orderBy(asc(document.createdAt));

      return documents;
    } catch (error) {
      console.error('Failed to get document by id from database');
      throw error;
    }
  };

  getDocumentById = async ({ id }: { id: string }): Promise<DbDocument | undefined> => {
    try {
      const [selectedDocument] = await this.db
        .select()
        .from(document)
        .where(eq(document.id, id))
        .orderBy(desc(document.createdAt));

      return selectedDocument;
    } catch (error) {
      console.error('Failed to get document by id from database');
      throw error;
    }
  };

  deleteDocumentsByIdAfterTimestamp = async ({ id, timestamp }: { id: string; timestamp: Date }): Promise<unknown> => {
    try {
      await this.db
        .delete(suggestion)
        .where(and(eq(suggestion.documentId, id), gt(suggestion.documentCreatedAt, timestamp)));

      return await this.db.delete(document).where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
    } catch (error) {
      console.error('Failed to delete documents by id after timestamp from database');
      throw error;
    }
  };

  saveSuggestions = ({ suggestions }: { suggestions: Array<Suggestion> }): ResultAsync<Suggestion[], DbError> => {
    return fromPromise(
      this.db.insert(suggestion).values(suggestions).returning(),
      e => new DbInternalError({ cause: e }),
    );
  };

  getSuggestionsByDocumentId = ({ documentId }: { documentId: string }): ResultAsync<Suggestion[], DbError> => {
    return fromPromise(
      this.db.select().from(suggestion).where(eq(suggestion.documentId, documentId)),
      e => new DbInternalError({ cause: e }),
    );
  };

  getMessageById = ({ id }: { id: string }): ResultAsync<Message, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      const messageResult = yield* fromPromise(
        db.select().from(message).where(eq(message.id, id)),
        e => new DbInternalError({ cause: e }),
      );

      return unwrapSingleQueryResult(messageResult, id, 'Message');
    });
  };
  deleteMessagesByChatIdAfterTimestamp = ({
    chatId,
    timestamp,
  }: {
    chatId: string;
    timestamp: Date;
  }): ResultAsync<undefined, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      const messagesToDelete = yield* fromPromise(
        db
          .select({ id: message.id })
          .from(message)
          .where(and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))),
        e => new DbInternalError({ cause: e }),
      );
      const messageIds = messagesToDelete.map(message => message.id);
      if (messageIds.length > 0) {
        const votes = fromPromise(
          db.delete(vote).where(and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))),
          e => new DbInternalError({ cause: e }),
        );
        const messages = fromPromise(
          db.delete(message).where(and(eq(message.chatId, chatId), inArray(message.id, messageIds))),
          e => new DbInternalError({ cause: e }),
        );
        yield* votes;
        yield* messages;
      }
      return ok(undefined);
    });
  };
  deleteTrailingMessages = ({ id }: { id: string }): ResultAsync<undefined, DbError> => {
    const getMessageById = this.getMessageById;
    const deleteMessagesByChatIdAfterTimestamp = this.deleteMessagesByChatIdAfterTimestamp;
    return safeTry(async function* () {
      const message = yield* getMessageById({ id });
      yield* deleteMessagesByChatIdAfterTimestamp({
        chatId: message.chatId,
        timestamp: message.createdAt,
      });
      return ok(undefined);
    });
  };

  updateChatVisiblityById = ({
    chatId,
    visibility,
  }: {
    chatId: string;
    visibility: 'private' | 'public';
  }): ResultAsync<undefined, DbError> => {
    const db = this.db;
    return safeTry(async function* () {
      yield* fromPromise(
        db.update(chat).set({ visibility }).where(eq(chat.id, chatId)),
        e => new DbInternalError({ cause: e }),
      );
      return ok(undefined);
    });
  };
}
