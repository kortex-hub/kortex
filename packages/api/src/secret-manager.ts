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

import { parse, stringify } from 'yaml';

export interface RecipeExtension {
  name: string;
  type: string;
  uri: string;
  headers?: Record<string, string>;
}

export interface RecipeWithExtensions {
  extensions?: Array<RecipeExtension>;
}

export class SecretManager {
  constructor(
    private readonly sensitiveKeys: string[],
    private readonly secretValues: string[],
  ) {}

  /**
   * Hides secrets in YAML content based on sensitive key patterns and values.
   *
   * @param content - The YAML content to process
   * @returns The processed YAML with secrets hidden by *
   */
  hideSecretsInYaml(content: string): string {
    let result = content;
    result = this.hideByKeys(result);
    result = this.hideByValues(result);
    return result;
  }

  private hideByValues(content: string): string {
    let result = content;
    for (const secretValue of this.secretValues) {
      if (secretValue && secretValue.length > 0) {
        const maskedValue = '*'.repeat(secretValue.length);
        result = result.replace(secretValue, maskedValue);
      }
    }
    return result;
  }

  private hideByKeys(content: string): string {
    try {
      const parts = content.split(/^---$/m);

      const processedParts = parts.map(part => {
        if (!part.trim()) return part;

        try {
          const parsed = parse(part);
          if (parsed?.kind === 'ConfigMap' && parsed?.data?.['recipe.yaml']) {
            const recipeContent = parsed.data['recipe.yaml'];
            const recipeParsed = parse(recipeContent) as RecipeWithExtensions;

            if (recipeParsed?.extensions) {
              recipeParsed.extensions = this.processExtensions(recipeParsed.extensions);
              parsed.data['recipe.yaml'] = this.stringifyRecipe(recipeParsed);
            }
            return this.stringifyRecipe(parsed);
          }

          const recipeParsed = parsed as RecipeWithExtensions;
          if (recipeParsed?.extensions) {
            recipeParsed.extensions = this.processExtensions(recipeParsed.extensions);
            return this.stringifyRecipe(recipeParsed);
          }

          return this.stringifyRecipe(parsed);
        } catch {
          return part;
        }
      });

      return processedParts.join('---\n');
    } catch (error) {
      console.warn('[SecretManager] Failed to parse YAML content for secret hiding:', error);
      return content;
    }
  }

  private processExtensions(extensions: RecipeExtension[]): RecipeExtension[] {
    return extensions.map(extension => {
      if (extension.headers) {
        const processedHeaders = this.processHeaders(extension.headers);
        if (processedHeaders !== extension.headers) {
          return {
            ...extension,
            headers: processedHeaders,
          };
        }
      }
      return extension;
    });
  }

  private processHeaders(headers: Record<string, string>): Record<string, string> {
    const hasSensitiveHeaders = Object.keys(headers).some(key => this.isSensitive(key));

    if (!hasSensitiveHeaders) {
      return headers;
    }

    const processed: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      const sensitive = this.isSensitive(key);
      processed[key] = sensitive ? '*'.repeat(value.length) : value;
    }
    return processed;
  }

  private isSensitive(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return this.sensitiveKeys.some(sensitiveKey => sensitiveKey.toLowerCase() === lowerKey);
  }

  private stringifyRecipe(parsed: RecipeWithExtensions): string {
    return stringify(parsed, {
      indent: 2,
      lineWidth: -1,
    });
  }
}
