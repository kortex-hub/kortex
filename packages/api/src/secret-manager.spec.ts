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
  test('should hide secret values by exact match', () => {
    const secretManager = new SecretManager(['google-api-key-12345', 'github-token-67890', 'another-key-value']);

    const content = `
apiVersion: v1
kind: ConfigMap
data:
  GOOGLE_API_KEY: google-api-key-12345
  recipe.yaml: |
    title: test-flow
    extensions:
      - name: github-mcp
        headers:
          Authorization: Bearer github-token-67890
          X-Api-Key: another-key-value
`;

    const result = secretManager.hideSecretsInYaml(content);

    // All secret values should be hidden
    expect(result).not.toContain('google-api-key-12345');
    expect(result).not.toContain('github-token-67890');
    expect(result).not.toContain('another-key-value');

    // Should contain the fixed-length mask
    expect(result).toContain('********************');
  });

  test('should handle empty secret values', () => {
    const secretManager = new SecretManager(['', 'valid-secret']);
    const content = 'data: valid-secret and empty: ';

    const result = secretManager.hideSecretsInYaml(content);

    expect(result).not.toContain('valid-secret');
    expect(result).toContain('********************');
  });

  test('should replace all occurrences of a secret', () => {
    const secretManager = new SecretManager(['my-secret-123']);
    const content = `
token1: my-secret-123
token2: my-secret-123
backup: my-secret-123
`;

    const result = secretManager.hideSecretsInYaml(content);

    // Should not contain any instance of the secret
    expect(result).not.toContain('my-secret-123');

    // Should have 3 masked values
    const maskCount = (result.match(/\*{20}/g) ?? []).length;
    expect(maskCount).toBe(3);
  });
});
