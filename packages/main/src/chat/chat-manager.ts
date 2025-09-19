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

import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DynamicToolUIPart, ModelMessage, StopCondition, ToolSet, UIMessage } from 'ai';
import { convertToModelMessages, generateText, stepCountIs, streamText } from 'ai';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { WebContents } from 'electron';
import { inject } from 'inversify';

import { IPCHandle, WebContentsType } from '/@/plugin/api.js';
import { Directories } from '/@/plugin/directories.js';
import type { InferenceParameters } from '/@api/chat/InferenceParameters.js';

import { MCPManager } from '../plugin/mcp/mcp-manager.js';
import { ProviderRegistry } from '../plugin/provider-registry.js';
import { runMigrate } from './db/migrate.js';

export class ChatManager {
  constructor(
    @inject(ProviderRegistry)
    private readonly providerRegistry: ProviderRegistry,
    @inject(MCPManager)
    private readonly mcpManager: MCPManager,
    @inject(WebContentsType)
    private readonly webContents: WebContents,
    @inject(IPCHandle)
    private readonly ipcHandle: IPCHandle,
    @inject(Directories)
    private readonly directories: Directories,
  ) {}

  public async init(): Promise<void> {
    const directory = this.directories.getChatPersistenceDirectory();
    if (!existsSync(directory)) {
      await mkdir(directory, { recursive: true });
    }
    const sqlite = new Database(join(directory, 'chat.db'));
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, {});

    runMigrate(db);

    this.ipcHandle('inference:streamText', (_, params) => this.streamText(params));
    this.ipcHandle('inference:generate', (_, params) => this.generate(params));

    this.ipcHandle('mcp-manager:getExchanges', async (_listener, mcpId: string): Promise<DynamicToolUIPart[]> => {
      return this.mcpManager.getExchanges(mcpId);
    });
  }

  private async convertMessages(messages: UIMessage[]): Promise<UIMessage[]> {
    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type === 'file' && part.url.startsWith('file://')) {
          const filename = fileURLToPath(part.url);
          const buffer = await readFile(filename);
          part.url = `data:${part.mediaType};base64,${buffer.toString('base64')}`;
        }
      }
    }
    return messages;
  }

  private getMostRecentUserMessage(messages: UIMessage[]): UIMessage | undefined {
    const userMessages = messages.filter(message => message.role === 'user');
    return userMessages.at(-1);
  }

  private async getInferenceComponents(params: InferenceParameters): Promise<{
    model: ReturnType<typeof sdk.languageModel>;
    messages: ModelMessage[];
    tools: ToolSet;
    stopWhen: StopCondition<ToolSet>;
    system: string;
  }> {
    const internalProviderId = this.providerRegistry.getMatchingProviderInternalId(params.providerId);
    const sdk = this.providerRegistry.getInferenceSDK(internalProviderId, params.connectionName);
    const model = sdk.languageModel(params.modelId);

    const userMessage = this.getMostRecentUserMessage(params.messages);

    if (!userMessage) {
      throw new Error('No user message found');
    }

    // ai sdk/fetch does not support file:URLs
    const convertedMessages = await this.convertMessages(params.messages);
    const messages = convertToModelMessages(convertedMessages);

    const tools = await this.mcpManager.getToolSet(params.mcp);

    return {
      model,
      messages,
      tools,
      stopWhen: stepCountIs(5),
      system: 'You are a friendly assistant! Keep your responses concise and helpful.',
    };
  }

  async streamText(params: InferenceParameters & { onDataId: number }): Promise<number> {
    const streaming = streamText(await this.getInferenceComponents(params));

    const reader = streaming.toUIMessageStream().getReader();

    // loop to wait for the stream to finish
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // end
        this.webContents.send('inference:streamText-onEnd', params.onDataId);
        break;
      }
      this.webContents.send('inference:streamText-onChunk', params.onDataId, value);
    }

    return params.onDataId;
  }

  async generate(params: InferenceParameters): Promise<string> {
    const result = await generateText(await this.getInferenceComponents(params));
    return result.text;
  }
}
