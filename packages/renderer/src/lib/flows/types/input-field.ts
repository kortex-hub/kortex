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

export const InputFieldSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Field name is required')
    .regex(
      /^[a-z][a-z0-9_]*$/,
      'Name must start with lowercase letter and contain only lowercase letters, numbers, and underscores',
    ),
  description: z.string().trim().min(1, 'Description is required'),
  format: z.enum(['string']),
  default: z.string().optional(),
  required: z.boolean(),
});

export type InputField = z.output<typeof InputFieldSchema>;
