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

export function buildChatSystemPrompt(prompt: string, extractedParamsContext: string): string {
  return `You are analyzing a conversation to extract reusable parameters from a prompt.

Current prompt: "${prompt}"

Your task:
1. Analyze the conversation above and the current prompt
2. Identify values in the prompt that could be parameterized (e.g., repository names, counts, dates, usernames, etc.)
3. Replace those values with {{parameterName}} placeholders using snake_case naming
4. For each parameter, provide a description and default value based on what was used in the conversation

Example:
- Original prompt: "Get the last 5 issues from podman-desktop/podman-desktop"
- Updated prompt: "Get the last {{count}} issues from {{owner}}/{{repo}}"
- Parameters: count (default: "5"), owner (default: "podman-desktop"), repo (default: "podman-desktop")
${extractedParamsContext}`;
}

export function buildPromptOnlySystemPrompt(prompt: string): string {
  return `You are analyzing a prompt to extract reusable parameters.

Current prompt: "${prompt}"

Your task:
1. Analyze the prompt and identify values that could be parameterized (e.g., repository names, counts, dates, usernames, URLs, etc.)
2. Replace those values with {{parameterName}} placeholders using snake_case naming
3. For each parameter, provide a description and extract the default value from the original prompt

Example:
- Original prompt: "Get the last 5 issues from podman-desktop/podman-desktop"
- Updated prompt: "Get the last {{count}} issues from {{owner}}/{{repo}}"
- Parameters: count (default: "5"), owner (default: "podman-desktop"), repo (default: "podman-desktop")`;
}
