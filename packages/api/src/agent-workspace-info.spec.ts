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

import { expect, test } from 'vitest';

import { getSandboxNameValidationError, SANDBOX_NAME_MAX_LENGTH } from './agent-workspace-info.js';

test('accepts names at exactly the maximum length', () => {
  const name = 'a'.repeat(SANDBOX_NAME_MAX_LENGTH);

  expect(getSandboxNameValidationError(name)).toBeUndefined();
});

test('rejects names exceeding the maximum length', () => {
  const name = 'a'.repeat(SANDBOX_NAME_MAX_LENGTH + 1);

  expect(getSandboxNameValidationError(name)).toBe(
    `Workspace name must not exceed ${SANDBOX_NAME_MAX_LENGTH} characters`,
  );
});
