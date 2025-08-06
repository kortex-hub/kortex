import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

import { DbEntityNotFoundError } from '/@api/chat/errors/db.js';

export function unwrapSingleQueryResult<T>(
	rows: T[],
	id: string,
	entityType: string,
): Result<T, DbEntityNotFoundError> {
	if (rows.length === 0) {
		return err(new DbEntityNotFoundError(id, entityType));
	}
	return ok(rows[0]) as Result<T, DbEntityNotFoundError>;
}
