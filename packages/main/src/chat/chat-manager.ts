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

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DynamicToolUIPart, ModelMessage, StopCondition, ToolSet, UIMessage } from 'ai';
import { convertToModelMessages, generateObject, generateText, stepCountIs, streamText } from 'ai';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { WebContents } from 'electron';
import { inject } from 'inversify';

import { IPCHandle, WebContentsType } from '/@/plugin/api.js';
import { Directories } from '/@/plugin/directories.js';
import {
  FlowGenerationParameters,
  FlowGenerationParametersSchema,
} from '/@api/chat/flow-generation-parameters-schema.js';
import type { InferenceParameters } from '/@api/chat/InferenceParameters.js';
import type { MessageConfig } from '/@api/chat/message-config.js';
import type { Chat, Message } from '/@api/chat/schema.js';

import { MCPManager } from '../plugin/mcp/mcp-manager.js';
import { ProviderRegistry } from '../plugin/provider-registry.js';
import { runMigrate } from './db/migrate.js';
import { ChatQueries } from './db/queries.js';

export class ChatManager {
  private chatQueries!: ChatQueries;
  private userId!: string;

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
    const sqlite = new Database(join(directory, 'chats.db'));
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, {});

    runMigrate(db);

    const chatQueries = new ChatQueries(db);

    this.chatQueries = chatQueries;

    async function getOrCreateUserId(): Promise<string> {
      const defaultUserEmail = 'default@localhost';
      const userGetter = await chatQueries.getUser(defaultUserEmail);
      if (userGetter.isOk()) {
        return userGetter.value.id;
      } else {
        const newUserGetter = await chatQueries.createAuthUser(defaultUserEmail, '');
        if (newUserGetter.isOk()) {
          return newUserGetter.value.id;
        } else {
          throw new Error('Cannot create user');
        }
      }
    }

    this.userId = await getOrCreateUserId();

    this.ipcHandle('inference:streamText', (_, params) => this.streamText(params));
    this.ipcHandle('inference:generate', (_, params) => this.generate(params));
    this.ipcHandle('inference:generateFlowParams', (_, params) => this.generateFlowParams(params));
    this.ipcHandle('mcp-manager:getExchanges', (_, mcpId: string) => this.getExchanges(mcpId));
    this.ipcHandle('inference:getChats', () => this.getChats());
    this.ipcHandle('inference:getChatMessagesById', (_, id: string) => this.getChatMessagesById(id));
    this.ipcHandle('inference:deleteChat', (_, id: string) => this.deleteChat(id));
    this.ipcHandle('inference:deleteAllChats', () => this.deleteAllChats());
  }

  private async getExchanges(mcpId: string): Promise<DynamicToolUIPart[]> {
    return this.mcpManager.getExchanges(mcpId);
  }

  private async getChats(): Promise<Chat[]> {
    return this.chatQueries.getChatsByUserId({ id: this.userId }).match(
      chats => chats,
      err => {
        throw err;
      },
    );
  }

  private async getChatMessagesById(id: string): Promise<{ chat: Chat | undefined; messages: Message[] }> {
    return (await this.chatQueries.getMessagesByChatId({ id })).match(
      async messages => {
        const chat = (await this.chatQueries.getChatById({ id })).match(
          chat => chat,
          () => {
            return undefined;
          },
        );
        return { chat, messages };
      },
      () => {
        return { chat: undefined, messages: [] };
      },
    );
  }

  private async deleteChat(id: string): Promise<undefined> {
    await this.chatQueries.deleteChatById({ id });
  }

  private async deleteAllChats(): Promise<undefined> {
    await this.chatQueries.deleteAllChatsForUser({ userId: this.userId });
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
    userMessage: UIMessage;
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

    const tools = await this.mcpManager.getToolSet(params.mcp, params.tools);

    return {
      model,
      userMessage,
      messages,
      tools,
      stopWhen: stepCountIs(5),
      system: 'You are a friendly assistant! Keep your responses concise and helpful.',
    };
  }

  async streamText(params: InferenceParameters & { onDataId: number; chatId: string }): Promise<number> {
    const { chatId } = params;
    const chatGetter = await this.chatQueries.getChatById({ id: chatId });
    const inferenceComponents = await this.getInferenceComponents(params);

    if (!chatGetter.isOk()) {
      const title = (
        await generateText({
          ...inferenceComponents,
          system: `\n
          - you will generate a short title based on the first message a user begins a conversation with
          - ensure it is not more than 80 characters long
          - the title should be a summary of the user's message
          - do not use quotes or colons`,
        })
      ).text;

      await this.chatQueries.saveChat({
        id: chatId,
        userId: this.userId,
        title,
      });
    }

    const config: MessageConfig = {
      mcp: params.mcp,
      tools: params.tools,
      modelId: params.modelId,
      connectionName: params.connectionName,
      providerId: params.providerId,
    };
    await this.chatQueries.saveMessages({
      messages: [
        {
          chatId,
          id: inferenceComponents.userMessage.id,
          role: 'user',
          parts: inferenceComponents.userMessage.parts,
          createdAt: new Date(),
          attachments: [],
          config,
        },
      ],
    });

    const streaming = streamText(inferenceComponents);

    const reader = streaming
      .toUIMessageStream({
        onFinish: async ({ messages }): Promise<void> => {
          await this.chatQueries.saveMessages({
            messages: messages.map(message => ({
              id: randomUUID().toString(),
              role: message.role,
              parts: message.parts,
              createdAt: new Date(),
              chatId,
              attachments: [],
              config,
            })),
          });
        },
      })
      .getReader();

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

  async generateFlowParams(params: InferenceParameters): Promise<FlowGenerationParameters> {
    const result = await generateObject({
      ...(await this.getInferenceComponents(params)),
      schema: FlowGenerationParametersSchema,
    });
    return result.object;
  }
}
