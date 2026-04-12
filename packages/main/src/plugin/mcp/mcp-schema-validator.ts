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
 * Keys allowed on `_meta['io.modelcontextprotocol.registry/official']` for validation normalization.
 * When the official registry adds new properties, sync this set with the bundled OpenAPI in
 * `@kortex-hub/mcp-registry-types` (e.g. `components.schemas` / ServerResponse `_meta`).
 */
const OFFICIAL_REGISTRY_META_KEYS = new Set(['status', 'publishedAt', 'updatedAt', 'isLatest']);

const OFFICIAL_REGISTRY_META_KEY = 'io.modelcontextprotocol.registry/official';

/** Nested `server` fields that track the upstream MCP server.json spec and often drift ahead of our bundled OpenAPI. */
const SERVER_NESTED_KEYS_TO_OMIT_FOR_VALIDATION = ['packages', 'remotes', 'icons'] as const;

/** `repository` is optional on ServerDetail; registries sometimes send `{}` which is invalid for bundled `Repository` (requires url + source). */
function isCompleteRepositoryForBundledSchema(repository: unknown): boolean {
  if (repository === null || typeof repository !== 'object' || Array.isArray(repository)) {
    return false;
  }
  const r = repository as Record<string, unknown>;
  return (
    typeof r['url'] === 'string' && r['url'].length > 0 && typeof r['source'] === 'string' && r['source'].length > 0
  );
}

/**
 * Build a shallow copy of a registry `ServerResponse` suitable for AJV validation against the
 * bundled `@kortex-hub/mcp-registry-types` schema:
 * - Official registry `_meta` may include keys not yet in the OpenAPI (e.g. `statusChangedAt`).
 * - `server.packages` / `remotes` / `icons` follow the live MCP server.json schema and may use
 *   shapes our package has not picked up yet.
 * - `server.repository` may be `{}` or otherwise incomplete; we omit it for validation only when it
 *   does not satisfy the bundled `Repository` schema.
 *
 * The original payload is never mutated; install/runtime code still sees the full server object.
 */
function normalizeServerResponseForSchemaValidation(jsonData: unknown): unknown {
  if (jsonData === null || typeof jsonData !== 'object' || Array.isArray(jsonData)) {
    return jsonData;
  }
  const response = jsonData as Record<string, unknown>;

  const server = response['server'];
  const serverIsObject = server !== null && typeof server === 'object' && !Array.isArray(server);
  const serverObj = serverIsObject ? (server as Record<string, unknown>) : null;

  const needsNestedOmit = serverObj && SERVER_NESTED_KEYS_TO_OMIT_FOR_VALIDATION.some(key => key in serverObj);
  const needsRepositoryOmit =
    serverObj && 'repository' in serverObj && !isCompleteRepositoryForBundledSchema(serverObj['repository']);

  let nextServer = server;
  if (serverObj && (needsNestedOmit || needsRepositoryOmit)) {
    const stripped: Record<string, unknown> = { ...serverObj };
    if (needsNestedOmit) {
      for (const key of SERVER_NESTED_KEYS_TO_OMIT_FOR_VALIDATION) {
        delete stripped[key];
      }
    }
    if (needsRepositoryOmit) {
      delete stripped['repository'];
    }
    nextServer = stripped;
  }

  const meta = response['_meta'];
  const metaIsObject = meta !== null && typeof meta === 'object' && !Array.isArray(meta);
  const metaObj = metaIsObject ? (meta as Record<string, unknown>) : null;

  let nextMeta = meta;
  if (metaObj) {
    const official = metaObj[OFFICIAL_REGISTRY_META_KEY];
    const officialIsObject = official !== null && typeof official === 'object' && !Array.isArray(official);
    const officialObj = officialIsObject ? (official as Record<string, unknown>) : null;

    if (officialObj) {
      const hasUnknownOfficialKey = Object.keys(officialObj).some(key => !OFFICIAL_REGISTRY_META_KEYS.has(key));
      if (hasUnknownOfficialKey) {
        const normalizedOfficial: Record<string, unknown> = {};
        for (const key of OFFICIAL_REGISTRY_META_KEYS) {
          if (key in officialObj) {
            normalizedOfficial[key] = officialObj[key];
          }
        }
        nextMeta = {
          ...metaObj,
          [OFFICIAL_REGISTRY_META_KEY]: normalizedOfficial,
        };
      }
    }
  }

  const changedServer = Boolean(needsNestedOmit) || Boolean(needsRepositoryOmit);
  const changedMeta = nextMeta !== meta;

  if (!changedServer && !changedMeta) {
    return jsonData;
  }

  return {
    ...response,
    server: nextServer,
    _meta: nextMeta,
  };
}

/**
 * Third-party registries sometimes publish `server.name` values that do not match the bundled
 * reverse-DNS pattern (e.g. `com.github.mcp` with no `/`). Treat pattern-only failures on
 * `server.name` as acceptable so listing works without console noise; the real name is unchanged.
 */
function isOnlyServerNamePatternFailure(errors: unknown): boolean {
  if (!Array.isArray(errors) || errors.length === 0) {
    return false;
  }
  return errors.every((e: { instancePath?: string; keyword?: string }) => {
    return e.instancePath === '/server/name' && e.keyword === 'pattern';
  });
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
    const payloadForValidation =
      schemaName === 'ServerResponse' ? normalizeServerResponseForSchemaValidation(jsonData) : jsonData;

    const validator = createValidator(schemaName);
    let isValid = validator(payloadForValidation);

    if (!isValid && schemaName === 'ServerResponse' && isOnlyServerNamePatternFailure(validator.errors)) {
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
