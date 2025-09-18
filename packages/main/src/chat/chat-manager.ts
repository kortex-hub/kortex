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
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { DynamicToolUIPart, ToolSet, UIMessage } from 'ai';
import { convertToModelMessages, generateText, stepCountIs, streamText } from 'ai';
import type { IpcMainInvokeEvent, WebContents } from 'electron';

import type { MCPManager } from '../plugin/mcp/mcp-manager.js';
import type { ProviderRegistry } from '../plugin/provider-registry.js';

export class ChatManager {
  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly mcpManager: MCPManager,
    private readonly getWebContentsSender: () => WebContents,
    private readonly ipcHandle: (
      channel: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      listener: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<void> | any,
    ) => void,
  ) {}

  public init(): void {
    this.ipcHandle('inference:streamText', this.streamText.bind(this));
    this.ipcHandle('inference:generate', this.generate.bind(this));

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

  async streamText(
    _listener: Electron.IpcMainInvokeEvent,
    providerId: string,
    connectionName: string,
    modelId: string,
    mcp: Array<string>,
    messages: UIMessage[],
    onDataId: number,
  ): Promise<number> {
    const internalProviderId = this.providerRegistry.getMatchingProviderInternalId(providerId);
    const sdk = this.providerRegistry.getInferenceSDK(internalProviderId, connectionName);
    const languageModel = sdk.languageModel(modelId);

    const userMessage = this.getMostRecentUserMessage(messages);

    if (!userMessage) {
      throw new Error('No user message found');
    }

    //ai sdk/fetch does not support file:URLs
    const convertedMessages = await this.convertMessages(messages);
    const modelMessages = convertToModelMessages(convertedMessages);

    const toolset = await this.mcpManager.getToolSet(mcp);

    const streaming = streamText({
      model: languageModel,
      messages: modelMessages,
      system: 'You are a friendly assistant! Keep your responses concise and helpful.',
      tools: toolset,

      stopWhen: stepCountIs(5),
    });

    const reader = streaming.toUIMessageStream().getReader();

    // loop to wait for the stream to finish
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // end
        this.getWebContentsSender().send('inference:streamText-onEnd', onDataId);
        break;
      }
      this.getWebContentsSender().send('inference:streamText-onChunk', onDataId, value);
    }

    return onDataId;
  }

  async generate(
    _listener: Electron.IpcMainInvokeEvent,
    internalProviderId: string,
    connectionName: string,
    model: string,
    prompt: string,
  ): Promise<string> {
    const sdk = this.providerRegistry.getInferenceSDK(internalProviderId, connectionName);
    const languageModel = sdk.languageModel(model);

    const toolSet: ToolSet = await this.mcpManager.getToolSet();

    const result = await generateText({
      model: languageModel,
      tools: toolSet,
      stopWhen: stepCountIs(5),
      prompt,
    });
    console.log('result', result);
    return result.text;
  }
}
