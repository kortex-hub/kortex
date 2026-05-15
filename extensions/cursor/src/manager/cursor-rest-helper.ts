/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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

import { injectable } from 'inversify';

export interface CursorModelItem {
  id: string;
}

@injectable()
export class CursorRestHelper {
  static readonly BASE_URL = 'https://api.cursor.com/v1';

  async listModels(token: string): Promise<CursorModelItem[]> {
    const credentials = Buffer.from(`${token}:`, 'utf-8').toString('base64');
    const res = await fetch(`${CursorRestHelper.BASE_URL}/models`, {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });
    if (!res.ok) {
      throw new Error(`failed to list Cursor models: ${res.status}`);
    }
    const body = await res.json();
    if (typeof body === 'object' && body !== null && 'items' in body && Array.isArray(body.items)) {
      return body.items.map((item: { id: string }) => ({ id: item.id }));
    }
    throw new Error('malformed response from Cursor API');
  }
}
