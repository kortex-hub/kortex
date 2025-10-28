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
import { describe, expect, test } from 'vitest';

import { SecretManager } from './secret-manager.js';

describe('SecretManager', () => {
  test('should hide values and keys', () => {
    const secretManager = new SecretManager(
      ['authorization', 'x-api-key'],
      ['google-api-key-12345', 'github-token-67890'],
    );
    const content = `
title: test-flow
extensions:
  - name: github-mcp
    headers:
      Authorization: Bearer github-token-67890
      X-Api-Key: another-key-value
data:
  GOOGLE_API_KEY: google-api-key-12345
`;

    const result = secretManager.hideSecretsInYaml(content);

    // Provider credentials hidden by value
    expect(result).not.toContain('google-api-key-12345');
    expect(result).not.toContain('Bearer github-token-67890');
    expect(result).not.toContain('another-key-value');
  });

  test('should return original content if YAML parsing fails', () => {
    const secretManager = new SecretManager(['authorization'], []);
    const invalidYaml = 'invalid: yaml: content: [[[';

    const result = secretManager.hideSecretsInYaml(invalidYaml);

    expect(result).toBe(invalidYaml);
  });
});
