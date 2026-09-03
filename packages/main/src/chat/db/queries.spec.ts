/**********************************************************************
 * Copyright (C) 2025-2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import { desc, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chat } from '/@api/chat/schema.js';

import { ChatQueries } from './queries.js';

vi.mock(import('better-sqlite3'));
vi.mock(import('drizzle-orm/better-sqlite3'));

describe('ChatQueries', () => {
  let queries: ChatQueries;
  let mockOrderBy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();

    mockOrderBy = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    const mockDb = { select: mockSelect } as never;

    queries = new ChatQueries(mockDb);
  });

  describe('getChatsByUserId', () => {
    it('should sort by createdAt desc with rowid desc as tiebreaker', async () => {
      await queries.getChatsByUserId({ id: 'user-1' });

      expect(mockOrderBy).toHaveBeenCalledTimes(1);
      const orderByArgs = mockOrderBy.mock.calls[0];

      // Ensure orderBy was called with arguments
      expect(orderByArgs).toBeDefined();
      if (!orderByArgs) return;

      // Should have two sort criteria: desc(createdAt) and desc(rowid)
      expect(orderByArgs).toHaveLength(2);

      // Verify first sort key is desc(chat.createdAt)
      const expectedCreatedAtDesc = desc(chat.createdAt);
      expect(orderByArgs[0]).toEqual(expectedCreatedAtDesc);

      // Verify second sort key is desc(sql`rowid`) for deterministic ordering
      const expectedRowidDesc = desc(sql`rowid`);
      expect(orderByArgs[1]).toEqual(expectedRowidDesc);
    });
  });
});
