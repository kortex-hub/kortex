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

import type { UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';

import { ParameterExtractor } from './parameter-extraction.js';

describe('ParameterExtractor', () => {
  const extractor = new ParameterExtractor();

  describe('extractFromMCPToolCalls', () => {
    it('should return empty array when no messages provided', () => {
      const result = extractor.extractFromMCPToolCalls([]);
      expect(result).toEqual([]);
    });

    it('should return empty array when messages have no tool calls', () => {
      const messages: UIMessage[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
        } as UIMessage,
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hi there' }],
        } as UIMessage,
      ];

      const result = extractor.extractFromMCPToolCalls(messages);
      expect(result).toEqual([]);
    });

    it('should extract parameters from single tool call', () => {
      const messages: UIMessage[] = [
        {
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'github_list_issues',
              input: {
                owner: 'podman-desktop',
                repo: 'podman-desktop',
              },
            },
          ],
        } as UIMessage,
      ];

      const result = extractor.extractFromMCPToolCalls(messages);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'owner',
        format: 'string',
        description: 'Parameter from github_list_issues MCP tool',
        default: 'podman-desktop',
        required: false,
      });
      expect(result[1]).toEqual({
        name: 'repo',
        format: 'string',
        description: 'Parameter from github_list_issues MCP tool',
        default: 'podman-desktop',
        required: false,
      });
    });

    it('should extract parameters with different data types', () => {
      const messages: UIMessage[] = [
        {
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'search',
              input: {
                query: 'test query',
                limit: 10,
                enabled: true,
              },
            },
          ],
        } as UIMessage,
      ];

      const result = extractor.extractFromMCPToolCalls(messages);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        name: 'query',
        format: 'string',
        description: 'Parameter from search MCP tool',
        default: 'test query',
        required: false,
      });
      expect(result[1]).toEqual({
        name: 'limit',
        format: 'string',
        description: 'Parameter from search MCP tool',
        default: '10',
        required: false,
      });
      expect(result[2]).toEqual({
        name: 'enabled',
        format: 'string',
        description: 'Parameter from search MCP tool',
        default: 'true',
        required: false,
      });
    });

    it('should extract parameters from multiple tool calls', () => {
      const messages: UIMessage[] = [
        {
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'github_get_repo',
              input: { repo: 'podman-desktop' },
            },
            {
              type: 'dynamic-tool',
              toolName: 'github_list_issues',
              input: { owner: 'containers', perPage: 5 },
            },
          ],
        } as UIMessage,
      ];

      const result = extractor.extractFromMCPToolCalls(messages);

      expect(result).toHaveLength(3);
      expect(result[0]?.name).toBe('repo');
      expect(result[0]?.description).toContain('github_get_repo');
      expect(result[1]?.name).toBe('owner');
      expect(result[1]?.description).toContain('github_list_issues');
      expect(result[2]?.name).toBe('perPage');
    });

    it('should extract parameters from multiple assistant messages', () => {
      const messages: UIMessage[] = [
        {
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'search_repos',
              input: { query: 'podman' },
            },
          ],
        } as UIMessage,
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Show me the issues' }],
        } as UIMessage,
        {
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'list_issues',
              input: { repo: 'podman-desktop' },
            },
          ],
        } as UIMessage,
      ];

      const result = extractor.extractFromMCPToolCalls(messages);

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('query');
      expect(result[1]?.name).toBe('repo');
    });
  });
});
