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

export class SecretManager {
  /** Fixed-length mask to hide secrets without revealing their actual length */
  private static readonly MASK = '********************';

  constructor(private readonly secretValues: string[]) {}

  /**
   * Hides secrets in YAML content by replacing exact secret values with a fixed-length mask
   */
  hideSecretsInYaml(content: string): string {
    let result = content;

    for (const secretValue of this.secretValues) {
      if (!secretValue) continue;

      result = result.replaceAll(secretValue, SecretManager.MASK);
    }

    return result;
  }
}
