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

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { RunError, RunOptions } from '@openkaiden/api';
import { inject, injectable } from 'inversify';

import { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import { Exec } from '/@/plugin/util/exec.js';

@injectable()
export abstract class OpenshellCliBase {
  constructor(
    @inject(Exec)
    protected readonly exec: Exec,
    @inject(CliToolRegistry)
    protected readonly cliToolRegistry: CliToolRegistry,
  ) {}

  getCliPath(): string {
    const tool = this.cliToolRegistry.getCliToolInfos().find(t => t.name === 'openshell');
    if (tool?.path) {
      return tool.path;
    }

    const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
    if (resourcesPath) {
      const bundledPath = join(resourcesPath, 'openshell', 'openshell');
      if (existsSync(bundledPath)) {
        return bundledPath;
      }
    }

    return 'openshell';
  }

  protected extractCliError(err: unknown): string {
    if (err instanceof Error && 'stdout' in err) {
      const runErr = err as RunError;

      const jsonError = this.tryExtractJsonError(runErr.stdout) ?? this.tryExtractJsonError(runErr.stderr);
      if (jsonError) {
        return jsonError;
      }

      if (runErr.stderr?.trim()) {
        return `${err.message} (stderr: ${runErr.stderr.trim()})`;
      }
      if (runErr.stdout?.trim()) {
        return `${err.message} (stdout: ${runErr.stdout.trim()})`;
      }
    }
    return err instanceof Error ? err.message : String(err);
  }

  protected tryExtractJsonError(output: string | undefined): string | undefined {
    if (typeof output !== 'string' || !output) {
      return undefined;
    }
    try {
      const parsed: unknown = JSON.parse(output);
      if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
        const errorField = (parsed as { error: unknown }).error;
        if (typeof errorField === 'string' && errorField) {
          return errorField;
        }
      }
    } catch {
      // not JSON
    }
    return undefined;
  }

  protected async runCli(
    args: string[],
    options?: { redact?: boolean; env?: { [p: string]: string }; quiet?: boolean },
  ): Promise<void> {
    const cliPath = this.getCliPath();
    const displayArgs = options?.redact ? this.redactSensitiveArgs(args) : args;
    if (!options?.quiet) {
      console.log(`Executing: ${cliPath} ${displayArgs.join(' ')}`);
    }
    try {
      await this.exec.exec(cliPath, args, options?.env ? { env: options.env } : undefined);
    } catch (err: unknown) {
      const detail = this.extractCliError(err);
      if (!options?.quiet) {
        console.error(`openshell failed: ${cliPath} ${displayArgs.join(' ')} — ${detail}`);
      }
      throw new Error(detail);
    }
  }

  protected redactSensitiveArgs(args: string[]): string[] {
    const sensitiveFlags = new Set(['--credential', '--config', '--env']);
    return args.map((arg, i) => {
      if (i > 0 && sensitiveFlags.has(args[i - 1]!)) {
        return '***';
      }
      return arg;
    });
  }

  protected async execCLI<T>(args: string[], options?: RunOptions): Promise<T> {
    const cliPath = this.getCliPath();
    const fullArgs = [...args, '-o', 'json'];
    try {
      const result = await this.exec.exec(cliPath, fullArgs, options);
      return JSON.parse(result.stdout) as T;
    } catch (err: unknown) {
      const detail = this.extractCliError(err);
      console.error(`openshell failed: ${cliPath} ${fullArgs.join(' ')} — ${detail}`);
      throw new Error(detail);
    }
  }
}
