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

import z from 'zod';

export const FlowGenerationParametersSchema = z.object({
  name: z
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
    .pipe(z.string().regex(/^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/, 'Invalid DNS subdomain name after transformation.')),
  description: z.string().describe('Description of the flow, give a short description of what the flow does.'),
  prompt: z
    .string()
    .describe(
      'Help me create a reproducible prompt that achieves the same result as in the conversation above. The prompt will be executed by another LLM without any further user input, so it must include all the necessary information to reproduce the same outcome.',
    ),
});

export type FlowGenerationParameters = z.output<typeof FlowGenerationParametersSchema>;
