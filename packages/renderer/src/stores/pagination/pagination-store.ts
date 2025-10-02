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

import type { Readable as SvelteReadable, Subscriber, Unsubscriber, Writable } from 'svelte/store';
import { writable } from 'svelte/store';

export interface PageResponse<T> {
  items: Array<T>;
  cursor?: string;
}

export abstract class PaginationStore<T> implements SvelteReadable<Array<T>> {
  #cursor: string | undefined;
  #limit: number | undefined;

  #store: Writable<Array<T>>;

  protected constructor(cursor: string | undefined, limit: number | undefined) {
    this.#cursor = cursor;
    this.#limit = limit;
    this.#store = writable([]);
  }

  public init(): Promise<void> {
    return this.next();
  }

  public hasNext(): boolean {
    return !!this.#cursor;
  }

  public reset(): Promise<void> {
    this.#cursor = undefined;
    return this.next();
  }

  protected abstract fetch(cursor?: string, limit?: number): Promise<PageResponse<T>>;

  public async next(): Promise<void> {
    const { cursor, items } = await this.fetch(this.#cursor, this.#limit);
    this.#cursor = cursor;
    this.#store.set(items);
  }

  public subscribe(run: Subscriber<Array<T>>, invalidate?: () => void): Unsubscriber {
    return this.#store.subscribe(run, invalidate);
  }
}
