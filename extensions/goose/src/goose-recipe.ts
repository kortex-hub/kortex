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
import { spawn } from 'node:child_process';
import { EventEmitter as NodeEventEmitter } from 'node:events';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';

import type {
  Provider,
  provider as ProviderAPI,
  ProviderConnectionStatus,
  ShellAccessSession,
  Workflow} from '@kortex-app/api';
import {
  Disposable,
  EventEmitter,
} from '@kortex-app/api';

import type { GooseCLI } from './goose-cli';

export class GooseRecipe implements Disposable {
  private gooseProvider: Provider | undefined = undefined;
  private readonly updateEmitter: EventEmitter<void> = new EventEmitter();

  constructor(
    private readonly provider: typeof ProviderAPI,
    private readonly gooseCLI: GooseCLI,
    ) {
  }

  protected getBasePath(): string {
    return join(homedir(), '.config', 'goose', 'recipes');
  }

  protected async all(): Promise<Array<Workflow>> {
    return this.gooseCLI.getRecipes({
      path: this.getBasePath(),
    });
  }

  protected open(workflow: Workflow): ShellAccessSession {
    console.log('[GooseRecipe] open', workflow);
    const emitter = new NodeEventEmitter();

    const child = spawn('goose', ['run', '--recipe', workflow.path], {
      stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
      cwd: this.getBasePath(),
    });

    child.stdout.on('data', data => {
      console.log('[GooseRecipe][stdout] data', Buffer.from(data).toString('utf-8'));
      emitter.emit('data', { data });
    });

    child.stderr.on('data', data => {
      console.log('[GooseRecipe][stderr] data', Buffer.from(data).toString('utf-8'));
      emitter.emit('error', { error: data });
    });

    child.on('exit', () => {
      console.log('[GooseRecipe][exit]');
      emitter.emit('end');
    });

    return {
      onData(listener): Disposable {
        emitter.on('data', listener);
        return Disposable.create(() => {
          emitter.off('data', listener);
        });
      },
      onError(listener): Disposable {
        emitter.on('error', listener);
        return Disposable.create(() => {
          emitter.off('error', listener);
        });
      },
      onEnd(listener): Disposable {
        emitter.on('end', listener);
        return Disposable.create(() => {
          emitter.off('end', listener);
        });
      },
      write(data): void {
        child.stdin.write(data);
      },
      resize(_dimensions): void {
        // Not supported without a real PTY
      },
      close(): void {
        child.kill();
      },
    };
  }

  init(): void {
    this.gooseProvider = this.provider.createProvider({
      id: 'goose',
      name: 'goose',
      status: 'unknown',
    });

    this.gooseProvider?.registerWorkflowProviderConnection({
      name: 'goose-recipes',
      workflow: {
        all: this.all.bind(this),
        onDidChange: this.updateEmitter.event,
        execute: this.open.bind(this),
      },
      lifecycle: {},
      status(): ProviderConnectionStatus {
        return 'unknown';
      },
    });
  }

  dispose(): void {
    this.gooseProvider?.dispose();
  }
}
