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

import { type components, createValidator } from '@kortex-hub/mcp-registry-types';
import { injectable } from 'inversify';

export interface SchemaValidationResult {
  isValid: boolean;
  /** Names of servers with invalid schemas (only populated when validating ServerList) */
  invalidServerNames: Set<string>;
}

/**
 * Service for validating MCP registry data against OpenAPI schemas.
 * Uses AJV validators created from the mcp-registry-types schemas.
 */
@injectable()
export class MCPSchemaValidator {
  /**
   * Validates JSON data against a specified schema component.
   *
   * @param jsonData - The data to validate
   * @param schemaName - The schema component name (e.g., 'ServerList', 'ServerResponse')
   * @param contextName - Optional context name for error messages (e.g., registry URL)
   * @param suppressWarnings - Optional flag to suppress warnings (default: false)
   * @returns Validation result with isValid flag and invalidServerNames (for ServerList)
   */
  validateSchemaData(
    jsonData: unknown,
    schemaName: keyof components['schemas'],
    contextName?: string,
    suppressWarnings: boolean = false,
  ): SchemaValidationResult {
    const validator = createValidator(schemaName);
    const isValid = validator(jsonData);
    const invalidServerNames = new Set<string>();

    if (!isValid && !suppressWarnings) {
      const context = contextName ? ` from '${contextName}'` : '';
      console.warn(
        `[MCPSchemaValidator] Failed to validate data against schema '${schemaName}'${context}.`,
        validator.errors,
      );
    }

    // For ServerList, extract the names of invalid servers from validation errors
    if (schemaName === 'ServerList' && validator.errors) {
      const serverList = jsonData as components['schemas']['ServerList'];
      const serverIndexRegex = /^\/servers\/(\d+)/;
      for (const error of validator.errors) {
        // Error paths look like "/servers/0/server/name" or "/servers/2/_meta"
        const match = serverIndexRegex.exec(error.instancePath);
        if (match?.[1]) {
          const serverIndex = parseInt(match[1], 10);
          const server = serverList.servers[serverIndex];
          if (server?.server?.name) {
            invalidServerNames.add(server.server.name);
          }
        }
      }
    }

    return {
      isValid,
      invalidServerNames,
    };
  }
}
