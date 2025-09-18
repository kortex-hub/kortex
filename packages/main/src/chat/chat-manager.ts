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

import type { DynamicToolUIPart, UIMessage } from 'ai';
import { convertToModelMessages, generateText, stepCountIs, streamText } from 'ai';
import type { IpcMainInvokeEvent, WebContents } from 'electron';

import type { InferenceParameters } from '/@api/chat/InferenceParameters.js';

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

  private async getInferenceComponents(
    params: InferenceParameters,
  ): Promise<Parameters<typeof streamText>[0] & Parameters<typeof generateText>[0]> {
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

  async streamText(
    _listener: Electron.IpcMainInvokeEvent,
    params: InferenceParameters & { onDataId: number },
  ): Promise<number> {
    const streaming = streamText(await this.getInferenceComponents(params));

    const reader = streaming.toUIMessageStream().getReader();

    // loop to wait for the stream to finish
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // end
        this.getWebContentsSender().send('inference:streamText-onEnd', params.onDataId);
        break;
      }
      this.getWebContentsSender().send('inference:streamText-onChunk', params.onDataId, value);
    }

    return params.onDataId;
  }

  async generate(_listener: Electron.IpcMainInvokeEvent, params: InferenceParameters): Promise<string> {
    const result = await generateText(await this.getInferenceComponents(params));
    return result.text;
  }
}
