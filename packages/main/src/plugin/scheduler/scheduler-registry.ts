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
import type { ProviderScheduler } from '@kortex-app/api';
import { inject, injectable } from 'inversify';

import { ApiSenderType } from '/@/plugin/api.js';
import type { ProviderImpl } from '/@/plugin/provider-impl.js';
import { Disposable } from '/@/plugin/types/disposable.js';
import type { IDisposable } from '/@api/disposable.js';

// Registry for all schedulers registered there
@injectable()
export class SchedulerRegistry implements IDisposable {
  #schedulers: Map<string, ProviderScheduler> = new Map();

  constructor(
    @inject(ApiSenderType)
    private apiSender: ApiSenderType,
  ) {}

  async init(): Promise<void> {}

  // Register a new scheduler
  register(providerImpl: ProviderImpl, scheduler: ProviderScheduler): Disposable {
    this.#schedulers.set(providerImpl.name, scheduler);

    const eventName = 'provider-scheduler-change';
    const eventPayload = { providerId: providerImpl.id, name: scheduler.name };

    this.apiSender.send(eventName, eventPayload);
    return Disposable.create(() => {
      this.#schedulers.delete(providerImpl.internalId);
      this.apiSender.send(eventName, eventPayload);
    });
  }

  dispose(): void {
    this.#schedulers.clear();
  }
}
