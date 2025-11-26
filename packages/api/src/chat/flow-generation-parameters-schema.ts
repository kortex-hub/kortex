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

import type { ZodType } from 'zod';
import z from 'zod';

export type FlowGenerationParameters = {
  name: string;
  description: string;
  prompt: string;
  parameters?: Array<FlowParameter>;
};

export type FlowParameterAIGenerated = {
  name: string;
  description: string;
  format: string;
  default?: string;
};

export type FlowParameter = FlowParameterAIGenerated & {
  required: boolean;
};

type FlowAIGeneratedParameters = {
  name: string;
  description: string;
  prompt: string;
  parameters?: Array<FlowParameterAIGenerated>;
};
export const FlowParameterSchema = z.object({
  name: z.string().describe('Parameter name (must be valid identifier)'),
  format: z.string().default('string').describe('Parameter data type'),
  description: z.string().describe('Human-readable description of the parameter'),
  default: z.string().optional().describe('Default value for the parameter'),
  // Note: 'required' is computed dynamically based on whether 'default' exists
});

// Reusable schema fields for flow metadata
const flowNameSchema = z
  .string()
  .describe(
    `A unique name for the flow, formatted as a DNS subdomain (e.g., "my-new-flow"). It must be lowercase and contain only letters, numbers, and hyphens. It cannot start or end with a hyphen.`,
  )
  .transform(val =>
    val
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, '') // Remove all other invalid characters
      .slice(0, 63),
  )
  .pipe(z.string().regex(/^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/, 'Invalid DNS subdomain name after transformation.'));

const flowDescriptionSchema = z
  .string()
  .describe('Description of the flow, give a short description of what the flow does.');

const flowPromptSchema = z
  .string()
  .describe(
    'Help me create a reproducible prompt template that achieves the same result as in the conversation above. The prompt will be executed by another LLM without any further user input, so it must include all the necessary information to reproduce the same outcome. Also include parameter placeholders like {{parameterName}}. Example: "Get the last {{count}} issues from {{owner}}/{{repo}}"',
  );

const flowParametersSchema = z
  .array(FlowParameterSchema)
  .optional()
  .describe(
    'Extract parameters from the conversation that can be modified when re-executing this flow. Analyze user messages and MCP tool inputs to identify values that should be parameterizable.',
  );

// Full schema (validates AI-generated parameters without 'required')
export const FlowGenerationParametersSchema: ZodType<FlowAIGeneratedParameters> = z.object({
  name: flowNameSchema,
  description: flowDescriptionSchema,
  prompt: flowPromptSchema,
  parameters: flowParametersSchema,
});
