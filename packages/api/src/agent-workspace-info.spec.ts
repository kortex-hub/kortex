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

import {
  getSandboxNameValidationError,
  SANDBOX_NAME_MAX_LENGTH,
  sanitizeDns1123Label,
} from './agent-workspace-info.js';

test('accepts valid lowercase names', () => {
  expect(getSandboxNameValidationError('my-workspace')).toBeUndefined();
});

test('accepts names with digits', () => {
  expect(getSandboxNameValidationError('test123')).toBeUndefined();
});

test('accepts single character name', () => {
  expect(getSandboxNameValidationError('a')).toBeUndefined();
});

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

test('rejects empty name', () => {
  expect(getSandboxNameValidationError('')).toBe('Workspace name must not be empty');
});

test('rejects names with spaces', () => {
  expect(getSandboxNameValidationError('my workspace')).toBe(
    'Workspace name must contain only lowercase letters (a-z), digits (0-9), and hyphens (-)',
  );
});

test('rejects names with uppercase letters', () => {
  expect(getSandboxNameValidationError('MyWorkspace')).toBe(
    'Workspace name must contain only lowercase letters (a-z), digits (0-9), and hyphens (-)',
  );
});

test('rejects names with special characters', () => {
  expect(getSandboxNameValidationError('my_workspace!')).toBe(
    'Workspace name must contain only lowercase letters (a-z), digits (0-9), and hyphens (-)',
  );
});

test('rejects names with leading hyphen', () => {
  expect(getSandboxNameValidationError('-workspace')).toBe('Workspace name must not start or end with a hyphen');
});

test('rejects names with trailing hyphen', () => {
  expect(getSandboxNameValidationError('workspace-')).toBe('Workspace name must not start or end with a hyphen');
});

test('rejects names with consecutive hyphens', () => {
  expect(getSandboxNameValidationError('my--workspace')).toBe(
    'Workspace name must not contain consecutive hyphens (--)',
  );
});

test('sanitizeDns1123Label lowercases and replaces spaces', () => {
  expect(sanitizeDns1123Label('My App')).toBe('my-app');
});

test('sanitizeDns1123Label replaces special characters with hyphens', () => {
  expect(sanitizeDns1123Label('my_app!v2')).toBe('my-app-v2');
});

test('sanitizeDns1123Label collapses consecutive hyphens', () => {
  expect(sanitizeDns1123Label('my  app')).toBe('my-app');
});

test('sanitizeDns1123Label strips leading and trailing hyphens', () => {
  expect(sanitizeDns1123Label(' My App ')).toBe('my-app');
});

test('sanitizeDns1123Label truncates to max length', () => {
  const long = 'a'.repeat(30);
  expect(sanitizeDns1123Label(long)).toBe('a'.repeat(SANDBOX_NAME_MAX_LENGTH));
});

test('sanitizeDns1123Label returns empty for empty input', () => {
  expect(sanitizeDns1123Label('')).toBe('');
});
