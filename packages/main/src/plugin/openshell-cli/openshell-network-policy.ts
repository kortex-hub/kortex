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

import z from 'zod';

import type { NetworkConfiguration } from '/@api/agent-workspace-info.js';
import type { PolicyUpdateOptions } from '/@api/openshell-gateway-info.js';

// ── OpenShell sandbox policy schema ────────────────────────────────

export const OpenshellRestAllowRuleSchema = z.object({
  allow: z.object({
    method: z.string(),
    path: z.string(),
    query: z.record(z.string(), z.union([z.string(), z.object({ any: z.array(z.string()) })])).optional(),
  }),
});

export const OpenshellGraphqlAllowRuleSchema = z.object({
  allow: z.object({
    operation_type: z.string(),
    operation_name: z.string().optional(),
    fields: z.array(z.string()).optional(),
  }),
});

export const OpenshellRestDenyRuleSchema = z.object({
  method: z.string(),
  path: z.string(),
  query: z.record(z.string(), z.union([z.string(), z.object({ any: z.array(z.string()) })])).optional(),
});

export const OpenshellGraphqlDenyRuleSchema = z.object({
  operation_type: z.string(),
  operation_name: z.string().optional(),
  fields: z.array(z.string()).optional(),
});

export const OpenshellEndpointSchema = z.object({
  host: z.string(),
  port: z.number().int(),
  path: z.string().optional(),
  protocol: z.enum(['rest', 'websocket', 'graphql']).optional(),
  tls: z.string().optional(),
  enforcement: z.enum(['enforce', 'audit']).optional(),
  access: z.enum(['read-only', 'read-write', 'full']).optional(),
  rules: z.array(z.union([OpenshellRestAllowRuleSchema, OpenshellGraphqlAllowRuleSchema])).optional(),
  deny_rules: z.array(z.union([OpenshellRestDenyRuleSchema, OpenshellGraphqlDenyRuleSchema])).optional(),
  allowed_ips: z.array(z.string()).optional(),
  allow_encoded_slash: z.boolean().optional(),
  websocket_credential_rewrite: z.boolean().optional(),
  request_body_credential_rewrite: z.boolean().optional(),
  persisted_queries: z.string().optional(),
  graphql_persisted_queries: z
    .record(
      z.string(),
      z.object({
        operation_type: z.string(),
        operation_name: z.string().optional(),
        fields: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  graphql_max_body_bytes: z.number().int().optional(),
});

export type OpenshellEndpoint = z.output<typeof OpenshellEndpointSchema>;

export const OpenshellBinarySchema = z.object({
  path: z.string(),
});

export type OpenshellBinary = z.output<typeof OpenshellBinarySchema>;

export const OpenshellNetworkPolicyEntrySchema = z.object({
  name: z.string().optional(),
  endpoints: z.array(OpenshellEndpointSchema),
  binaries: z.array(OpenshellBinarySchema),
});

export type OpenshellNetworkPolicyEntry = z.output<typeof OpenshellNetworkPolicyEntrySchema>;

export const OpenshellFilesystemPolicySchema = z.object({
  include_workdir: z.boolean().optional(),
  read_only: z.array(z.string()).optional(),
  read_write: z.array(z.string()).optional(),
});

export const OpenshellLandlockSchema = z.object({
  compatibility: z.enum(['best_effort', 'hard_requirement']).optional(),
});

export const OpenshellProcessSchema = z.object({
  run_as_user: z.string().optional(),
  run_as_group: z.string().optional(),
});

export const OpenshellPolicySchema = z.object({
  version: z.literal(1),
  filesystem_policy: OpenshellFilesystemPolicySchema.optional(),
  landlock: OpenshellLandlockSchema.optional(),
  process: OpenshellProcessSchema.optional(),
  network_policies: z.record(z.string(), OpenshellNetworkPolicyEntrySchema).optional(),
});

export type OpenshellPolicy = z.output<typeof OpenshellPolicySchema>;

// ── Policy endpoint builder ───────────────────────────────────────

const NETWORK_RULE_NAME = 'kdn-network';

export function buildNetworkPolicyEndpoints(network: NetworkConfiguration): string[] | undefined {
  if (network.mode === 'allow') {
    return undefined;
  }

  if (!network.hosts?.length) {
    return [];
  }

  return network.hosts.flatMap(host => [`${host}:443:full`, `${host}:80:full`]);
}

export function buildNetworkPolicyOperations(
  sandboxName: string,
  network: NetworkConfiguration,
): PolicyUpdateOptions[] {
  const removeOp: PolicyUpdateOptions = {
    sandboxName,
    removeRule: NETWORK_RULE_NAME,
  };

  const endpoints = buildNetworkPolicyEndpoints(network);
  if (!endpoints?.length) {
    return [removeOp];
  }

  const operations = [removeOp];

  for (const endpoint of endpoints) {
    operations.push({
      sandboxName,
      ruleName: NETWORK_RULE_NAME,
      addEndpoints: [endpoint],
      binary: '/**',
      wait: true,
    });
  }

  return operations;
}
