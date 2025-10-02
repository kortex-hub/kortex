/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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
import type { components } from '@kortex-hub/mcp-registry-types';

import { type PageResponse, PaginationStore } from '/@/stores/pagination/pagination-store';

export class MCPRegistryStore extends PaginationStore<components['schemas']['ServerDetail']> {
  constructor(
    public baseURL: string,
    cursor?: string,
    limit?: number,
  ) {
    super(cursor, limit);
  }

  protected async fetch(
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<PageResponse<components['schemas']['ServerDetail']>> {
    const serverList = await window.getMcpRegistryServers(this.baseURL, cursor, limit);
    return {
      items: serverList.servers.map(server => server.server),
      cursor: serverList.metadata?.nextCursor,
    };
  }
}
