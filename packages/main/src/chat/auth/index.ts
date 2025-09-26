import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import ms from 'ms';
import type { ResultAsync } from 'neverthrow';
import { ok, safeTry } from 'neverthrow';

import type { ChatQueries } from '/@/chat/db/queries.js';
import type { DbError } from '/@api/chat/errors/db.js';
import type { Session, User } from '/@api/chat/schema.js';

export type SessionValidationResult = { session: Session; user: User } | { session: null; user: null };

export class SessionManager {
  constructor(private readonly chatQueries: ChatQueries) {}

  public generateSessionToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = encodeBase32LowerCaseNoPadding(bytes);
    return token;
  }

  public createSession(token: string, userId: string): ResultAsync<Session, DbError> {
    const createSessionDb = this.chatQueries.createSession;
    return safeTry(async function* () {
      const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
      const session: Session = {
        id: sessionId,
        userId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      };
      yield* createSessionDb(session);
      return ok(session);
    });
  }

  public validateSessionToken(token: string): ResultAsync<SessionValidationResult, DbError> {
    const { getFullSession, deleteSession, extendSession } = this.chatQueries;
    return safeTry(async function* () {
      const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
      const { user, session } = yield* getFullSession(sessionId);
      if (Date.now() >= session.expiresAt.getTime()) {
        yield* deleteSession(sessionId);
        return ok({ session: null, user: null });
      }
      if (Date.now() >= session.expiresAt.getTime() - ms('15d')) {
        yield* extendSession(sessionId);
      }
      return ok({ session, user });
    });
  }

  public invalidateSession(sessionId: string): ResultAsync<undefined, DbError> {
    return this.chatQueries.deleteSession(sessionId);
  }

  public invalidateAllSessions(userId: string): ResultAsync<undefined, DbError> {
    return this.chatQueries.deleteSessionsForUser(userId);
  }
}
