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
import type {
  ProviderScheduleExecution,
  ProviderScheduler,
  ProviderScheduleResult,
  ProviderSchedulerOptions,
} from '@kortex-app/api';
import { inject, injectable } from 'inversify';

import { ApiSenderType, IPCHandle } from '/@/plugin/api.js';
import type { ProviderImpl } from '/@/plugin/provider-impl.js';
import { Disposable } from '/@/plugin/types/disposable.js';
import type { IDisposable } from '/@api/disposable.js';
import type { ProviderScheduleItemInfo } from '/@api/scheduler/scheduler-api-info.js';

// Registry for all schedulers registered there
@injectable()
export class SchedulerRegistry implements IDisposable {
  #schedulers: Map<string, ProviderScheduler> = new Map();

  constructor(
    @inject(ApiSenderType)
    private apiSender: ApiSenderType,
    @inject(IPCHandle)
    private readonly ipcHandle: IPCHandle,
  ) {}

  async init(): Promise<void> {
    // handle get all schedulers
    this.ipcHandle('scheduler:get-all', async (): Promise<string[]> => {
      return this.getSchedulerNames();
    });

    this.ipcHandle(
      'scheduler:delete-schedule',
      async (_listener, schedulerName: string, scheduleId: string): Promise<void> => {
        return this.deleteSchedule(schedulerName, scheduleId);
      },
    );

    this.ipcHandle(
      'scheduler:get-execution',
      async (_listener, schedulerName: string, id: string): Promise<ProviderScheduleExecution | undefined> => {
        const scheduler = this.#schedulers.get(schedulerName);
        if (!scheduler) {
          throw new Error(`Scheduler with name ${schedulerName} not found`);
        }
        return scheduler.getExecution(id);
      },
    );
  }

  async deleteSchedule(schedulerName: string, scheduleId: string): Promise<void> {
    const scheduler = this.#schedulers.get(schedulerName);
    if (!scheduler) {
      throw new Error(`Scheduler with name ${schedulerName} not found`);
    }
    await scheduler.cancel(scheduleId);
    this.apiSender.send('scheduler-updated-entry', { schedulerName });
  }

  async listItems(metadataKeys: string[]): Promise<ProviderScheduleItemInfo[]> {
    const entries = Array.from(this.#schedulers.entries());

    const allItems = await Promise.all(
      entries.map(async ([name, scheduler]) => {
        const items = await scheduler.list({ metadataKeys });
        return items.map(item => ({ ...item, schedulerName: name }));
      }),
    );
    // Flatten the arrays
    return allItems.flat();
  }

  async schedule(schedulerName: string, options: ProviderSchedulerOptions): Promise<ProviderScheduleResult> {
    const scheduler = this.#schedulers.get(schedulerName);
    if (!scheduler) {
      throw new Error(`Scheduler with name ${schedulerName} not found`);
    }
    const result = await scheduler.schedule(options);
    this.apiSender.send('scheduler-updated-entry', { schedulerName });
    return result;
  }

  getSchedulerNames(): string[] {
    return Array.from(this.#schedulers.values()).map(scheduler => scheduler.name);
  }

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
