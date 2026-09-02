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

import { inject, injectable } from 'inversify';

import { Emitter } from '/@/plugin/events/emitter.js';
import { OpenshellSdkClientManager } from '/@/plugin/openshell-cli/openshell-sdk-client-manager.js';
import type { AcpFlowDraftPolicyChunk } from '/@api/acp-session-info.js';
import type { IDisposable } from '/@api/disposable.js';

import { generalizeDenialPath } from './forge-path-generalizer.js';

export interface DraftPolicyEvent {
  sandboxId: string;
  sandboxName: string;
  chunks: AcpFlowDraftPolicyChunk[];
  totalPending: number;
}

interface DenialLogEntry {
  timestampMs: number;
  isL7: boolean;
  host: string;
  port: number;
  method?: string;
  path?: string;
  binary?: string;
  denyReason?: string;
  protocol?: 'rest' | 'graphql';
  operationType?: string;
  operationName?: string;
  graphqlFields?: string[];
}

interface SandboxWatchState {
  sandboxName: string;
  gatewayName?: string;
  abortController: AbortController;
  denialLogBuffer: DenialLogEntry[];
  chunkState: Map<string, InternalChunkState>;
  reconnectAttempt: number;
  reconnectTimer?: ReturnType<typeof setTimeout>;
}

interface InternalChunkState {
  chunk: AcpFlowDraftPolicyChunk;
  isL4Proposal: boolean;
  reviewToken?: string;
  serverChunkId?: string;
}

const DENIAL_BUFFER_TTL_MS = 60_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

@injectable()
export class DraftPolicyWatcher {
  readonly #subscriptions = new Map<string, SandboxWatchState>();

  readonly #onDraftPolicyUpdate = new Emitter<DraftPolicyEvent>();
  readonly onDraftPolicyUpdate = this.#onDraftPolicyUpdate.event;

  constructor(
    @inject(OpenshellSdkClientManager)
    private readonly sdkClientManager: OpenshellSdkClientManager,
  ) {}

  async watchSandbox(sandboxId: string, sandboxName: string, gatewayName?: string): Promise<IDisposable> {
    if (this.#subscriptions.has(sandboxId)) {
      return { dispose: () => this.unwatchSandbox(sandboxId) };
    }

    const state: SandboxWatchState = {
      sandboxName,
      gatewayName,
      abortController: new AbortController(),
      denialLogBuffer: [],
      chunkState: new Map(),
      reconnectAttempt: 0,
    };
    this.#subscriptions.set(sandboxId, state);

    await this.#fetchExistingDrafts(sandboxId, state);
    this.#startStream(sandboxId, state);

    return { dispose: () => this.unwatchSandbox(sandboxId) };
  }

  unwatchSandbox(sandboxId: string): void {
    const state = this.#subscriptions.get(sandboxId);
    if (!state) return;

    state.abortController.abort();
    if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
    this.#subscriptions.delete(sandboxId);
  }

  unwatchSandboxByName(sandboxName: string): void {
    for (const [sandboxId, state] of this.#subscriptions) {
      if (state.sandboxName === sandboxName) {
        this.unwatchSandbox(sandboxId);
        return;
      }
    }
  }

  async approveDraftChunk(sandboxId: string, chunkId: string): Promise<void> {
    const state = this.#subscriptions.get(sandboxId);
    if (!state) throw new Error(`Not watching sandbox ${sandboxId}`);

    const internal = state.chunkState.get(chunkId);
    if (!internal) throw new Error(`Chunk ${chunkId} not found`);

    const client = await this.sdkClientManager.getClient(state.gatewayName);

    if (internal.isL4Proposal) {
      await client.raw.approveDraftChunk({
        name: state.sandboxName,
        chunkId: internal.serverChunkId ?? chunkId,
        reviewToken: internal.reviewToken ?? '',
      });
    } else {
      await this.#applyPolicyUpdate(client, state.sandboxName, internal.chunk);
    }

    internal.chunk.status = 'approved';
  }

  async rejectDraftChunk(sandboxId: string, chunkId: string): Promise<void> {
    const state = this.#subscriptions.get(sandboxId);
    if (!state) throw new Error(`Not watching sandbox ${sandboxId}`);

    const internal = state.chunkState.get(chunkId);
    if (!internal) throw new Error(`Chunk ${chunkId} not found`);

    if (internal.isL4Proposal) {
      const client = await this.sdkClientManager.getClient(state.gatewayName);
      await client.raw.rejectDraftChunk({
        name: state.sandboxName,
        chunkId: internal.serverChunkId ?? chunkId,
        reason: 'Rejected by user',
      });
    }

    internal.chunk.status = 'rejected';
  }

  async #applyPolicyUpdate(
    client: Awaited<ReturnType<OpenshellSdkClientManager['getClient']>>,
    sandboxName: string,
    chunk: AcpFlowDraftPolicyChunk,
  ): Promise<void> {
    const endpointProtocol = chunk.protocol ?? (chunk.isL7 ? 'rest' : undefined);
    const allow = this.#buildAllowRule(chunk, endpointProtocol);

    // Use addAllowRules when exactly one rule owns this host:port AND its binary
    // scope covers the denial binary. addAllowRules appends to the existing
    // endpoint (no ambiguity risk), but it can't update binaries — so if the
    // denial binary isn't in scope, addAllowRules would have no effect.
    const config = await client.sandbox.getConfig(sandboxName);
    const matchingRules = config.policy
      ? Object.values(config.policy.networkPolicies).filter(rule =>
          rule.endpoints.some(
            (ep: { host: string; port: number; ports?: number[] }) =>
              ep.host === chunk.host && (ep.port === chunk.port || ep.ports?.includes(chunk.port)),
          ),
        )
      : [];

    const canUseAddAllowRules =
      matchingRules.length === 1 && this.#binaryCoveredByRule(chunk.binaries, matchingRules[0]!);

    if (canUseAddAllowRules) {
      await client.raw.updateConfig({
        name: sandboxName,
        mergeOperations: [
          {
            operation: {
              case: 'addAllowRules',
              value: {
                host: chunk.host,
                port: chunk.port,
                rules: [{ allow }],
              },
            },
          },
        ],
      });
    } else {
      // Multiple rules (or none) share this host:port — addAllowRules can't
      // disambiguate, so create a new rule instead.
      const endpoint: Record<string, unknown> = {
        host: chunk.host,
        port: chunk.port,
      };
      if (endpointProtocol) {
        endpoint['protocol'] = endpointProtocol;
        endpoint['enforcement'] = 'enforce';
        if (endpointProtocol === 'graphql') {
          endpoint['path'] = '/graphql';
        }
      }
      await client.raw.updateConfig({
        name: sandboxName,
        mergeOperations: [
          {
            operation: {
              case: 'addRule',
              value: {
                ruleName: chunk.ruleName,
                rule: {
                  name: chunk.ruleName,
                  endpoints: [{ ...endpoint, rules: [{ allow }] }],
                  binaries: chunk.binaries.map(path => ({ path })),
                },
              },
            },
          },
        ],
      });
    }
  }

  #buildAllowRule(chunk: AcpFlowDraftPolicyChunk, protocol?: string): Record<string, unknown> {
    if (protocol === 'graphql') {
      const allow: Record<string, unknown> = {};
      if (chunk.operationType) allow['operation_type'] = chunk.operationType;
      if (chunk.operationName) allow['operation_name'] = chunk.operationName;
      if (chunk.graphqlFields?.length) allow['fields'] = chunk.graphqlFields;
      return allow;
    }
    return {
      method: chunk.method ?? '*',
      path: chunk.path ?? '/**',
    };
  }

  #binaryCoveredByRule(denialBinaries: string[], rule: { binaries?: Array<{ path: string }> }): boolean {
    const ruleBinaries = rule.binaries?.map(b => b.path) ?? [];
    if (ruleBinaries.length === 0) return true;
    if (ruleBinaries.some(b => b === '/**' || b === '*')) return true;
    return denialBinaries.every(
      db =>
        db === '/**' || ruleBinaries.some(rb => db === rb || (rb.endsWith('/**') && db.startsWith(rb.slice(0, -2)))),
    );
  }

  async #fetchExistingDrafts(sandboxId: string, state: SandboxWatchState): Promise<void> {
    try {
      const client = await this.sdkClientManager.getClient(state.gatewayName);
      const response = await client.raw.getDraftPolicy({
        name: state.sandboxName,
        statusFilter: 'pending',
      });

      if (response.chunks.length > 0) {
        const mapped = response.chunks.map(c => this.#policyChunkToFlowChunk(c));
        for (const { chunk, reviewToken } of mapped) {
          state.chunkState.set(chunk.chunkId, { chunk, isL4Proposal: true, reviewToken });
        }
        this.#onDraftPolicyUpdate.fire({
          sandboxId,
          sandboxName: state.sandboxName,
          chunks: mapped.map(m => m.chunk),
          totalPending: mapped.length,
        });
      }
    } catch (err: unknown) {
      console.error(`[DraftPolicy] failed to fetch existing drafts for ${state.sandboxName}:`, err);
    }
  }

  #startStream(sandboxId: string, state: SandboxWatchState): void {
    const iterate = async (): Promise<void> => {
      try {
        const client = await this.sdkClientManager.getClient(state.gatewayName);
        const stream = client.raw.watchSandbox(
          {
            id: sandboxId,
            followLogs: true,
            followStatus: true,
            followEvents: false,
            logSources: ['sandbox'],
            logTailLines: 0,
          },
          { signal: state.abortController.signal },
        );

        state.reconnectAttempt = 0;

        for await (const event of stream) {
          if (!event.payload) continue;

          switch (event.payload.case) {
            case 'draftPolicyUpdate':
              await this.#handleDraftPolicyUpdate(sandboxId, state);
              break;
            case 'sandbox':
              await this.#handleSandboxStateChange(sandboxId, state);
              break;
            case 'log':
              this.#handleLogLine(sandboxId, state, event.payload.value);
              break;
            default:
          }
        }
      } catch (err: unknown) {
        if (state.abortController.signal.aborted) {
          return;
        }

        const delay = Math.min(1000 * 2 ** state.reconnectAttempt, MAX_RECONNECT_DELAY_MS);
        state.reconnectAttempt++;
        console.error(
          `[DraftPolicy] stream error for ${state.sandboxName}, reconnecting in ${delay}ms (attempt ${state.reconnectAttempt}):`,
          err,
        );
        state.reconnectTimer = setTimeout(() => {
          if (!state.abortController.signal.aborted) {
            this.#startStream(sandboxId, state);
          }
        }, delay);
      }
    };

    iterate().catch((err: unknown) => {
      console.error(`[DraftPolicy] unexpected iterate error for ${state.sandboxName}:`, err);
    });
  }

  async #handleDraftPolicyUpdate(sandboxId: string, state: SandboxWatchState): Promise<void> {
    await this.#refetchDraftPolicy(sandboxId, state);
  }

  async #handleSandboxStateChange(sandboxId: string, state: SandboxWatchState): Promise<void> {
    await this.#refetchDraftPolicy(sandboxId, state);
  }

  async #refetchDraftPolicy(sandboxId: string, state: SandboxWatchState): Promise<void> {
    try {
      const client = await this.sdkClientManager.getClient(state.gatewayName);
      const response = await client.raw.getDraftPolicy({
        name: state.sandboxName,
        statusFilter: 'pending',
      });

      const newChunks: AcpFlowDraftPolicyChunk[] = [];
      for (const policyChunk of response.chunks) {
        if (state.chunkState.has(policyChunk.id)) continue;

        const endpoint = policyChunk.proposedRule?.endpoints?.[0];
        const host = endpoint?.host ?? 'unknown';
        const port = endpoint?.port ?? 0;

        const existingEntry = Array.from(state.chunkState.entries()).find(
          ([, s]) => s.chunk.host === host && s.chunk.port === port,
        );
        if (existingEntry) {
          const [, existing] = existingEntry;
          // Upgrade a client-side chunk with server data (binary, reviewToken) if still pending
          if (!existing.isL4Proposal && existing.chunk.status === 'pending') {
            const { chunk, reviewToken } = this.#policyChunkToFlowChunk(policyChunk);
            existing.chunk.binaries = chunk.binaries;
            existing.isL4Proposal = true;
            existing.reviewToken = reviewToken;
            existing.serverChunkId = chunk.chunkId;
          }
          continue;
        }

        const { chunk, reviewToken } = this.#policyChunkToFlowChunk(policyChunk);
        this.#enrichWithDenialLogs(chunk, state);
        state.chunkState.set(chunk.chunkId, { chunk, isL4Proposal: true, reviewToken });
        newChunks.push(chunk);
      }

      if (newChunks.length > 0) {
        this.#onDraftPolicyUpdate.fire({
          sandboxId,
          sandboxName: state.sandboxName,
          chunks: newChunks,
          totalPending: newChunks.length,
        });
      }
    } catch (err: unknown) {
      console.error(`[DraftPolicy] failed to fetch draft policy for ${state.sandboxName}:`, err);
    }
  }

  #handleLogLine(
    sandboxId: string,
    state: SandboxWatchState,
    logLine: { fields: { [key: string]: string }; timestampMs: bigint; message: string; level: string; source: string },
  ): void {
    const denial = this.#parseDenialFromLogLine(logLine);
    if (!denial) return;

    const entry: DenialLogEntry = {
      timestampMs: Number(logLine.timestampMs),
      ...denial,
    };

    state.denialLogBuffer.push(entry);
    this.#pruneBuffer(state);

    this.#emitDenialFromLog(sandboxId, state, entry);
  }

  #parseDenialFromLogLine(logLine: {
    fields: { [key: string]: string };
    message: string;
    level: string;
  }): Omit<DenialLogEntry, 'timestampMs'> | undefined {
    const fields = logLine.fields;

    // Try structured fields first (sandbox-pushed non-OCSF logs may populate them)
    if (fields['l4_decision'] === 'deny' || fields['l7_decision'] === 'deny') {
      const host = fields['dst_host'];
      const portStr = fields['dst_port'];
      if (!host || !portStr) return undefined;
      const port = parseInt(portStr, 10);
      if (isNaN(port)) return undefined;

      const protocol = fields['l7_protocol'] === 'graphql' ? ('graphql' as const) : undefined;
      return {
        isL7: fields['l7_decision'] === 'deny',
        host,
        port,
        method: fields['l7_action'],
        path: fields['l7_target'],
        binary: fields['binary'],
        denyReason: fields['l7_deny_reason'] ?? fields['l4_deny_reason'],
        protocol,
      };
    }

    const msg = logLine.message;

    // L7_REQUEST denial (GraphQL, MCP, etc.):
    //   L7_REQUEST deny POST host:port/path graphql_ops=type=mutation name=Op fields=f1,f2 ...
    if (msg.startsWith('L7_REQUEST')) {
      // eslint-disable-next-line sonarjs/slow-regex
      const l7Match = /^L7_REQUEST\s+deny\s+(\w+)\s+([^/:]+):(\d+)(\/\S*)?/.exec(msg);
      if (!l7Match) return undefined;

      const result: Omit<DenialLogEntry, 'timestampMs'> = {
        isL7: true,
        host: l7Match[2]!,
        port: parseInt(l7Match[3]!, 10),
        method: l7Match[1],
        path: l7Match[4] ?? '/',
        denyReason: msg,
      };

      // eslint-disable-next-line sonarjs/slow-regex
      const gqlOps = /graphql_ops=(.+?)(?:\s+persisted=|\s+\[|$)/.exec(msg);
      if (gqlOps) {
        result.protocol = 'graphql';
        const opsStr = gqlOps[1]!;
        const typeMatch = /type=(\w+)/.exec(opsStr);
        const nameMatch = /name=(\w+)/.exec(opsStr);
        const fieldsMatch = /fields=(\S+)/.exec(opsStr);
        if (typeMatch) result.operationType = typeMatch[1];
        if (nameMatch) result.operationName = nameMatch[1];
        if (fieldsMatch) result.graphqlFields = fieldsMatch[1]!.split(',');
      }

      return result;
    }

    if (!msg.includes('DENIED')) return undefined;

    const reasonMatch = /\[reason:([^\]]+)\]/.exec(msg);
    const denyReason = reasonMatch?.[1]?.trim();

    // L7 HTTP denial: HTTP:POST [MED] DENIED proc(pid) -> POST https://host:port/path
    const httpMatch = msg.startsWith('HTTP:')
      ? /DENIED\s+(?:\S+\s+->\s+)?(\w+)\s+\w+:\/\/([^/:]+):(\d+)(\/\S*)?/.exec(msg)
      : undefined;
    if (httpMatch) {
      return {
        isL7: true,
        protocol: 'rest',
        host: httpMatch[2]!,
        port: parseInt(httpMatch[3]!, 10),
        method: httpMatch[1],
        path: httpMatch[4] ?? '/',
        denyReason,
      };
    }

    // L4 network denial
    const netMatch = /^NET:\w+\s+\[\w+\]\s+DENIED\s+(?:\S+\s+->\s+)?([^:\s]+):(\d+)/.exec(msg);
    if (netMatch) {
      return {
        isL7: false,
        host: netMatch[1]!,
        port: parseInt(netMatch[2]!, 10),
        denyReason,
      };
    }

    return undefined;
  }

  #emitDenialFromLog(sandboxId: string, state: SandboxWatchState, denial: DenialLogEntry): void {
    if (denial.denyReason?.includes('policy changed') || denial.denyReason?.includes('policy generation is stale'))
      return;

    const isL7 = denial.method !== undefined && denial.path !== undefined;
    const isGraphql = denial.protocol === 'graphql';
    const alreadyCovered = Array.from(state.chunkState.values()).some(s => {
      if (s.chunk.host !== denial.host || s.chunk.port !== denial.port) return false;
      if (!s.chunk.isL7) return true;
      if (isGraphql && s.chunk.protocol === 'graphql') {
        return s.chunk.operationType === denial.operationType && s.chunk.status !== 'approved';
      }
      return isL7 && s.chunk.method === denial.method && s.chunk.status !== 'approved';
    });
    if (alreadyCovered) return;

    const suffix = isGraphql
      ? `gql-${denial.host}-${denial.port}-${denial.operationType}-${denial.operationName}-${Date.now()}`
      : isL7
        ? `l7-${denial.host}-${denial.port}-${denial.method}-${Date.now()}`
        : `l4-${denial.host}-${denial.port}-${Date.now()}`;
    const chunkId = suffix;
    const sanitizedHost = denial.host.replace(/[.-]/g, '_').replace(/\W/g, '');
    const protocolSuffix = isGraphql
      ? `_gql_${denial.operationType ?? 'op'}`
      : isL7
        ? `_${(denial.method ?? 'any').toLowerCase()}`
        : '';
    const ruleName = `allow_${sanitizedHost}_${denial.port}${protocolSuffix}`;

    const chunk: AcpFlowDraftPolicyChunk = {
      chunkId,
      ruleName,
      status: 'pending',
      host: denial.host,
      port: denial.port,
      binaries: denial.binary ? [denial.binary] : ['/**'],
      rationale:
        denial.denyReason ??
        (isGraphql
          ? `GraphQL ${denial.operationType} ${denial.operationName} was denied`
          : isL7
            ? `${denial.method} ${denial.path} was denied`
            : `Connection to ${denial.host}:${denial.port} was denied`),
      hasSecurityNotes: false,
      isL7,
      protocol: denial.protocol,
      method: denial.method,
      path: isL7 && !isGraphql ? generalizeDenialPath(denial.host, denial.path!) : denial.path,
      operationType: denial.operationType,
      operationName: denial.operationName,
      graphqlFields: denial.graphqlFields,
    };

    state.chunkState.set(chunkId, { chunk, isL4Proposal: false });

    this.#onDraftPolicyUpdate.fire({
      sandboxId,
      sandboxName: state.sandboxName,
      chunks: [chunk],
      totalPending: Array.from(state.chunkState.values()).filter(s => s.chunk.status === 'pending').length,
    });
  }

  #enrichWithDenialLogs(chunk: AcpFlowDraftPolicyChunk, state: SandboxWatchState): void {
    const match = state.denialLogBuffer.find(d => d.host === chunk.host && d.port === chunk.port && d.method && d.path);

    if (match) {
      chunk.isL7 = true;
      chunk.method = match.method;
      chunk.path = match.path;
    }
  }

  #policyChunkToFlowChunk(policyChunk: {
    id: string;
    status: string;
    ruleName: string;
    proposedRule?: { endpoints: Array<{ host: string; port: number }>; binaries: Array<{ path: string }> };
    rationale: string;
    securityNotes: string;
    confidence: number;
    reviewToken?: string;
  }): { chunk: AcpFlowDraftPolicyChunk; reviewToken?: string } {
    const endpoint = policyChunk.proposedRule?.endpoints?.[0];
    return {
      chunk: {
        chunkId: policyChunk.id,
        ruleName: policyChunk.ruleName,
        status:
          policyChunk.status === 'pending' ? 'pending' : policyChunk.status === 'approved' ? 'approved' : 'rejected',
        host: endpoint?.host ?? 'unknown',
        port: endpoint?.port ?? 0,
        binaries: policyChunk.proposedRule?.binaries?.map(b => b.path) ?? [],
        rationale: policyChunk.rationale,
        hasSecurityNotes: !!policyChunk.securityNotes,
        isL7: false,
      },
      reviewToken: policyChunk.reviewToken,
    };
  }

  #pruneBuffer(state: SandboxWatchState): void {
    const cutoff = Date.now() - DENIAL_BUFFER_TTL_MS;
    state.denialLogBuffer = state.denialLogBuffer.filter(e => e.timestampMs > cutoff);
  }

  dispose(): void {
    for (const sandboxId of this.#subscriptions.keys()) {
      this.unwatchSandbox(sandboxId);
    }
    this.#onDraftPolicyUpdate.dispose();
  }
}
