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
  host: string;
  port: number;
  method?: string;
  path?: string;
  binary?: string;
  denyReason?: string;
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
      console.log(`[DraftPolicy] already watching sandbox ${sandboxName} (${sandboxId}), skipping`);
      return { dispose: () => this.unwatchSandbox(sandboxId) };
    }

    console.log(`[DraftPolicy] watching sandbox ${sandboxName} (id=${sandboxId}, gateway=${gatewayName ?? 'default'})`);

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
    const config = await client.sandbox.getConfig(sandboxName);
    const policy = config.policy;

    const matchingEndpoint =
      policy &&
      Object.values(policy.networkPolicies)
        .flatMap(rule => rule.endpoints)
        .find(ep => ep.host === chunk.host && (ep.port === chunk.port || ep.ports.includes(chunk.port)));

    if (matchingEndpoint && matchingEndpoint.protocol) {
      // Endpoint has L7 inspection — append allow rules
      await client.raw.updateConfig({
        name: sandboxName,
        mergeOperations: [
          {
            operation: {
              case: 'addAllowRules',
              value: {
                host: chunk.host,
                port: chunk.port,
                rules: [
                  {
                    allow: {
                      method: chunk.method ?? '*',
                      path: chunk.path ?? '/**',
                    },
                  },
                ],
              },
            },
          },
        ],
      });
    } else if (!matchingEndpoint) {
      // Endpoint not in policy — create a new rule
      const endpoint: { host: string; port: number; protocol?: string; enforcement?: string } = {
        host: chunk.host,
        port: chunk.port,
      };
      if (chunk.isL7) {
        endpoint.protocol = 'rest';
        endpoint.enforcement = 'enforce';
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
                  endpoints: [endpoint],
                  binaries: chunk.binaries.map(path => ({ path })),
                },
              },
            },
          },
        ],
      });
    }
    // else: endpoint exists as L4-only — already allowed, nothing to do
  }

  async #fetchExistingDrafts(sandboxId: string, state: SandboxWatchState): Promise<void> {
    try {
      console.log(`[DraftPolicy] fetching existing drafts for ${state.sandboxName}`);
      const client = await this.sdkClientManager.getClient(state.gatewayName);
      const response = await client.raw.getDraftPolicy({
        name: state.sandboxName,
        statusFilter: 'pending',
      });

      console.log(`[DraftPolicy] got ${response.chunks.length} existing draft chunks for ${state.sandboxName}`);

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
        console.log(`[DraftPolicy] starting WatchSandbox stream for ${state.sandboxName} (id=${sandboxId})`);
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

        console.log(`[DraftPolicy] WatchSandbox stream connected for ${state.sandboxName}`);
        state.reconnectAttempt = 0;

        for await (const event of stream) {
          if (!event.payload) continue;

          switch (event.payload.case) {
            case 'draftPolicyUpdate':
              console.log(
                `[DraftPolicy] received draftPolicyUpdate for ${state.sandboxName}: newChunks=${event.payload.value.newChunks}, totalPending=${event.payload.value.totalPending}`,
              );
              await this.#handleDraftPolicyUpdate(sandboxId, state, event.payload.value);
              break;
            case 'sandbox':
              console.log(
                `[DraftPolicy] sandbox state changed for ${state.sandboxName}, checking for new draft chunks`,
              );
              await this.#handleSandboxStateChange(sandboxId, state);
              break;
            case 'log':
              this.#handleLogLine(sandboxId, state, event.payload.value);
              break;
            default:
              console.log(`[DraftPolicy] received event type: ${event.payload.case} for ${state.sandboxName}`);
          }
        }
        console.log(`[DraftPolicy] WatchSandbox stream ended for ${state.sandboxName}`);
      } catch (err: unknown) {
        if (state.abortController.signal.aborted) {
          console.log(`[DraftPolicy] stream aborted for ${state.sandboxName}`);
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

  async #handleDraftPolicyUpdate(
    sandboxId: string,
    state: SandboxWatchState,
    update: { newChunks: number; totalPending: number; summary: string; draftVersion: bigint },
  ): Promise<void> {
    console.log(
      `[DraftPolicy] fetching draft policy after update (version=${update.draftVersion}) for ${state.sandboxName}`,
    );
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

      console.log(
        `[DraftPolicy] getDraftPolicy returned ${response.chunks.length} pending chunks for ${state.sandboxName}`,
      );

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
        console.log(
          `[DraftPolicy] firing ${newChunks.length} new chunks for ${state.sandboxName}:`,
          newChunks.map(c => `${c.host}:${c.port}`).join(', '),
        );
        this.#onDraftPolicyUpdate.fire({
          sandboxId,
          sandboxName: state.sandboxName,
          chunks: newChunks,
          totalPending: newChunks.length,
        });
      } else if (response.chunks.length > 0) {
        console.log(`[DraftPolicy] no new chunks after filtering (${response.chunks.length} already known)`);
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

    const layer = denial.isL7 ? 'L7' : 'L4';
    const detail = denial.method ? ` ${denial.method} ${denial.path}` : '';
    console.log(
      `[DraftPolicy] denial detected for ${state.sandboxName}: ${layer} ${denial.host}:${denial.port}${detail}`,
    );

    const entry: DenialLogEntry = {
      timestampMs: Number(logLine.timestampMs),
      ...denial,
    };

    state.denialLogBuffer.push(entry);
    this.#pruneBuffer(state);

    this.#emitDenialFromLog(sandboxId, state, entry);
  }

  #parseDenialFromLogLine(logLine: { fields: { [key: string]: string }; message: string; level: string }):
    | {
        isL7: boolean;
        host: string;
        port: number;
        method?: string;
        path?: string;
        binary?: string;
        denyReason?: string;
      }
    | undefined {
    const fields = logLine.fields;

    // Try structured fields first (sandbox-pushed non-OCSF logs may populate them)
    if (fields['l4_decision'] === 'deny' || fields['l7_decision'] === 'deny') {
      const host = fields['dst_host'];
      const portStr = fields['dst_port'];
      if (!host || !portStr) return undefined;
      const port = parseInt(portStr, 10);
      if (isNaN(port)) return undefined;

      return {
        isL7: fields['l7_decision'] === 'deny',
        host,
        port,
        method: fields['l7_action'],
        path: fields['l7_target'],
        binary: fields['binary'],
        denyReason: fields['l7_deny_reason'] ?? fields['l4_deny_reason'],
      };
    }

    // Parse OCSF shorthand message format:
    //   NET:CONNECT [MED] DENIED proc(pid) -> host:port [policy:...] [reason:...]
    //   HTTP:METHOD [MED] DENIED proc(pid) -> METHOD scheme://host:port/path [policy:...] [reason:...]
    const msg = logLine.message;
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

    const alreadyCovered = Array.from(state.chunkState.values()).some(
      s => s.chunk.host === denial.host && s.chunk.port === denial.port,
    );
    if (alreadyCovered) return;

    const isL7 = denial.method !== undefined && denial.path !== undefined;
    const chunkId = isL7
      ? `l7-${denial.host}-${denial.port}-${denial.method}-${Date.now()}`
      : `l4-${denial.host}-${denial.port}-${Date.now()}`;
    const sanitizedHost = denial.host.replace(/[.-]/g, '_').replace(/\W/g, '');
    const ruleName = `allow_${sanitizedHost}_${denial.port}`;

    const chunk: AcpFlowDraftPolicyChunk = {
      chunkId,
      ruleName,
      status: 'pending',
      host: denial.host,
      port: denial.port,
      binaries: denial.binary ? [denial.binary] : ['/**'],
      rationale:
        denial.denyReason ??
        (isL7
          ? `${denial.method} ${denial.path} was denied`
          : `Connection to ${denial.host}:${denial.port} was denied`),
      hasSecurityNotes: false,
      isL7,
      method: denial.method,
      path: isL7 ? generalizeDenialPath(denial.host, denial.path!) : undefined,
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
