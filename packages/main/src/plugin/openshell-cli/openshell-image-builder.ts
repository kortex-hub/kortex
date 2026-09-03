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
 **********************************************************************/

import { inject, injectable } from 'inversify';

import { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import { Exec } from '/@/plugin/util/exec.js';

export interface BuildImageOptions {
  agent?: string;
  inference?: string;
  endpoint?: string;
  model?: string;
  config?: string;
  /** Working directory for the process. The tool reads `.kaiden/workspace.json` from here. */
  cwd?: string;
}

/**
 * Wrapper around the `openshell-image-builder` CLI binary.
 *
 * Usage:
 *   openshell-image-builder [OPTIONS] <TAG>
 *
 * Options:
 *   --agent <AGENT>         Agent to install (claude, opencode)
 *   --inference <INFERENCE>  Inference provider (anthropic, vertexai, ollama, openai)
 *   --endpoint <URL>        Override inference provider URL
 *   --model <MODEL>         Default model for the agent
 *   --config <DIR>          Config directory containing config.toml
 *   -v / -vv                Log verbosity
 */
@injectable()
export class OpenshellImageBuilder {
  constructor(
    @inject(Exec)
    private readonly exec: Exec,
    @inject(CliToolRegistry)
    private readonly cliToolRegistry: CliToolRegistry,
  ) {}

  getCliPath(): string {
    const tool = this.cliToolRegistry.getCliToolInfos().find(t => t.name === 'openshell-image-builder');
    if (tool?.path) {
      return tool.path;
    }
    return 'openshell-image-builder';
  }

  async getVersion(): Promise<string> {
    const cliPath = this.getCliPath();
    try {
      const result = await this.exec.exec(cliPath, ['--version']);
      return result.stdout.trim();
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`openshell-image-builder failed: ${cliPath} --version — ${detail}`);
      throw new Error(detail);
    }
  }

  async buildImage(tag: string, options: BuildImageOptions = {}): Promise<void> {
    const args: string[] = [];

    if (options.config) {
      args.push('--config', options.config);
    }
    if (options.agent) {
      args.push('--agent', options.agent);
    }
    if (options.inference) {
      args.push('--inference', options.inference);
    }
    if (options.endpoint) {
      args.push('--endpoint', options.endpoint);
    }
    if (options.model) {
      args.push('--model', options.model);
    }

    args.push(tag);

    const cliPath = this.getCliPath();
    console.log(`Executing: ${cliPath} ${args.join(' ')}`);
    try {
      await this.exec.exec(cliPath, args, { cwd: options.cwd });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`openshell-image-builder failed: ${cliPath} ${args.join(' ')} — ${detail}`);
      throw new Error(detail);
    }
  }
}
