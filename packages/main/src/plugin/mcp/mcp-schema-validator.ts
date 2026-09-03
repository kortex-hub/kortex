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

import { type components, createValidator } from '@openkaiden/mcp-registry-types';
import { injectable } from 'inversify';

/**
 * Determines whether a single AJV validation error can be tolerated for `ServerResponse`
 * payloads from live MCP registries.
 *
 * Tolerated errors:
 * - `statusChangedAt` additionalProperty: official registry includes this field not yet in bundled schema
 * - `repository` missing `url` or `source`: registry sometimes returns empty repository objects as placeholders
 * - Errors under `/server/packages`: packageArguments and other nested structures evolve independently
 */
function isTolerableValidationError(error: {
  keyword?: string;
  instancePath?: string;
  params?: { additionalProperty?: string; missingProperty?: string };
}): boolean {
  if (error.keyword === 'additionalProperties' && error.params?.additionalProperty === 'statusChangedAt') {
    return true;
  }
  if (
    error.keyword === 'required' &&
    error.instancePath === '/server/repository' &&
    (error.params?.missingProperty === 'url' || error.params?.missingProperty === 'source')
  ) {
    return true;
  }
  const path = error.instancePath;
  if (path && (path === '/server/packages' || path.startsWith('/server/packages/'))) {
    return true;
  }
  return false;
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
   * @returns true if the data is valid, false otherwise
   */
  validateSchemaData(
    jsonData: unknown,
    schemaName: keyof components['schemas'],
    contextName?: string,
    suppressWarnings: boolean = false,
  ): boolean {
    const validator = createValidator(schemaName);
    let isValid = validator(jsonData);

    if (!isValid && schemaName === 'ServerResponse' && validator.errors?.every(isTolerableValidationError)) {
      isValid = true;
    }

    if (!isValid && !suppressWarnings) {
      const context = contextName ? ` from '${contextName}'` : '';
      console.warn(
        `[MCPSchemaValidator] Failed to validate data against schema '${schemaName}'${context}. Payload:`,
        jsonData,
        'errors:',
        validator.errors,
      );
    }

    return isValid;
  }
}
