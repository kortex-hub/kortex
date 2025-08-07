import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import ms from 'ms';
import type { ResultAsync } from 'neverthrow';
import { ok, safeTry } from 'neverthrow';

import {
  createSession as createSessionDb,
  deleteSession,
  deleteSessionsForUser,
  extendSession,
  getFullSession,
} from '/@/chat/db/queries.js';
import type { Session, User } from '/@/chat/db/schema.js';
import type { DbError } from '/@api/chat/errors/db.js';

export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = encodeBase32LowerCaseNoPadding(bytes);
  return token;
}

export function createSession(token: string, userId: string): ResultAsync<Session, DbError> {
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

export function validateSessionToken(token: string): ResultAsync<SessionValidationResult, DbError> {
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

export function invalidateSession(sessionId: string): ResultAsync<undefined, DbError> {
  return deleteSession(sessionId);
}

export function invalidateAllSessions(userId: string): ResultAsync<undefined, DbError> {
  return deleteSessionsForUser(userId);
}
export type SessionValidationResult = { session: Session; user: User } | { session: null; user: null };
