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

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { CursorRestHelper } from './cursor-rest-helper';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

describe('listModels', () => {
  test('should return model items on success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [{ id: 'model-a' }, { id: 'model-b' }] }),
    });

    const helper = new CursorRestHelper();
    const result = await helper.listModels('myToken');

    expect(result).toEqual([{ id: 'model-a' }, { id: 'model-b' }]);
  });

  test('should send Basic Auth header with token', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    });

    const helper = new CursorRestHelper();
    await helper.listModels('myToken');

    const expectedCredentials = Buffer.from('myToken:').toString('base64');
    expect(fetchMock).toHaveBeenCalledWith('https://api.cursor.com/v1/models', {
      headers: {
        Authorization: `Basic ${expectedCredentials}`,
      },
    });
  });

  test('should throw on non-ok response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
    });

    const helper = new CursorRestHelper();
    await expect(helper.listModels('badToken')).rejects.toThrowError('failed to list Cursor models: 401');
  });

  test('should throw on malformed response without data field', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ models: [] }),
    });

    const helper = new CursorRestHelper();
    await expect(helper.listModels('myToken')).rejects.toThrowError('malformed response from Cursor API');
  });

  test('should throw when data is not an array', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'not-an-array' }),
    });

    const helper = new CursorRestHelper();
    await expect(helper.listModels('myToken')).rejects.toThrowError('malformed response from Cursor API');
  });
});
