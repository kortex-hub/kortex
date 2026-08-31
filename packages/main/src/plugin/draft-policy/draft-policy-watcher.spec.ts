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

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { OpenshellSdkClientManager } from '/@/plugin/openshell-cli/openshell-sdk-client-manager.js';

import type { DraftPolicyEvent } from './draft-policy-watcher.js';
import { DraftPolicyWatcher } from './draft-policy-watcher.js';

function createMockClient(): {
  raw: {
    watchSandbox: ReturnType<typeof vi.fn>;
    getDraftPolicy: ReturnType<typeof vi.fn>;
    approveDraftChunk: ReturnType<typeof vi.fn>;
    rejectDraftChunk: ReturnType<typeof vi.fn>;
    updateConfig: ReturnType<typeof vi.fn>;
  };
} {
  return {
    raw: {
      watchSandbox: vi.fn(),
      getDraftPolicy: vi.fn().mockResolvedValue({ chunks: [] }),
      approveDraftChunk: vi.fn().mockResolvedValue({ policyVersion: 1 }),
      rejectDraftChunk: vi.fn().mockResolvedValue({}),
      updateConfig: vi.fn().mockResolvedValue({ version: 1 }),
    },
  };
}

function neverEndingStream(): AsyncGenerator<never> {
  // eslint-disable-next-line require-yield, sonarjs/generator-without-yield
  return (async function* (): AsyncGenerator<never> {
    await new Promise(() => {});
  })();
}

function createSdkManager(client: ReturnType<typeof createMockClient>): OpenshellSdkClientManager {
  return {
    getClient: vi.fn().mockResolvedValue(client),
    invalidate: vi.fn(),
    dispose: vi.fn(),
  } as unknown as OpenshellSdkClientManager;
}

describe('DraftPolicyWatcher', () => {
  let watcher: DraftPolicyWatcher;
  let client: ReturnType<typeof createMockClient>;
  let sdkManager: OpenshellSdkClientManager;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    client = createMockClient();
    sdkManager = createSdkManager(client);
    watcher = new DraftPolicyWatcher(sdkManager);
  });

  afterEach(() => {
    watcher.dispose();
    vi.useRealTimers();
  });

  describe('watchSandbox', () => {
    test('fetches existing drafts on connect', async () => {
      const pendingChunk = {
        id: 'chunk-1',
        status: 'pending',
        ruleName: 'allow-example',
        proposedRule: {
          endpoints: [{ host: 'example.com', port: 443 }],
          binaries: [{ path: '/usr/bin/curl' }],
        },
        rationale: 'Denied by policy',
        securityNotes: '',
        confidence: 0.9,
      };
      client.raw.getDraftPolicy.mockResolvedValue({ chunks: [pendingChunk] });

      // Create an empty async iterable that never yields
      client.raw.watchSandbox.mockReturnValue(neverEndingStream());

      const events: DraftPolicyEvent[] = [];
      watcher.onDraftPolicyUpdate(e => events.push(e));

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      // Let the microtask for getDraftPolicy resolve
      await vi.advanceTimersByTimeAsync(0);

      expect(events).toHaveLength(1);
      expect(events[0]!.sandboxId).toBe('sandbox-1');
      expect(events[0]!.chunks).toHaveLength(1);
      expect(events[0]!.chunks[0]!.host).toBe('example.com');
      expect(events[0]!.chunks[0]!.port).toBe(443);
      expect(events[0]!.chunks[0]!.status).toBe('pending');
    });

    test('does not duplicate subscriptions for same sandbox', async () => {
      client.raw.watchSandbox.mockReturnValue(neverEndingStream());

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      await watcher.watchSandbox('sandbox-1', 'my-sandbox');

      expect(client.raw.watchSandbox).toHaveBeenCalledTimes(1);
    });

    test('returns disposable that unwatches', async () => {
      client.raw.watchSandbox.mockReturnValue(neverEndingStream());

      const disposable = await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      disposable.dispose();

      // Should be able to watch again after disposing
      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      expect(client.raw.watchSandbox).toHaveBeenCalledTimes(2);
    });
  });

  describe('approveDraftChunk', () => {
    test('calls approveDraftChunk RPC for L4 proposals', async () => {
      const pendingChunk = {
        id: 'chunk-1',
        status: 'pending',
        ruleName: 'allow-example',
        proposedRule: {
          endpoints: [{ host: 'example.com', port: 443 }],
          binaries: [],
        },
        rationale: 'Denied',
        securityNotes: '',
        confidence: 0.9,
        reviewToken: 'token-abc',
      };
      client.raw.getDraftPolicy.mockResolvedValue({ chunks: [pendingChunk] });
      client.raw.watchSandbox.mockReturnValue(neverEndingStream());

      await watcher.watchSandbox('sandbox-1', 'my-sandbox', 'gateway-1');
      await vi.advanceTimersByTimeAsync(0);

      await watcher.approveDraftChunk('sandbox-1', 'chunk-1');

      expect(client.raw.approveDraftChunk).toHaveBeenCalledWith({
        name: 'my-sandbox',
        chunkId: 'chunk-1',
        reviewToken: 'token-abc',
      });
    });

    test('throws for unknown sandbox', async () => {
      await expect(watcher.approveDraftChunk('unknown', 'chunk-1')).rejects.toThrow('Not watching sandbox');
    });

    test('throws for unknown chunk', async () => {
      client.raw.watchSandbox.mockReturnValue(neverEndingStream());
      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      await vi.advanceTimersByTimeAsync(0);

      await expect(watcher.approveDraftChunk('sandbox-1', 'unknown-chunk')).rejects.toThrow('not found');
    });
  });

  describe('rejectDraftChunk', () => {
    test('calls rejectDraftChunk RPC for L4 proposals', async () => {
      const pendingChunk = {
        id: 'chunk-1',
        status: 'pending',
        ruleName: 'allow-example',
        proposedRule: {
          endpoints: [{ host: 'example.com', port: 443 }],
          binaries: [],
        },
        rationale: 'Denied',
        securityNotes: '',
        confidence: 0.9,
      };
      client.raw.getDraftPolicy.mockResolvedValue({ chunks: [pendingChunk] });
      client.raw.watchSandbox.mockReturnValue(neverEndingStream());

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      await vi.advanceTimersByTimeAsync(0);

      await watcher.rejectDraftChunk('sandbox-1', 'chunk-1');

      expect(client.raw.rejectDraftChunk).toHaveBeenCalledWith({
        name: 'my-sandbox',
        chunkId: 'chunk-1',
        reason: 'Rejected by user',
      });
    });
  });

  describe('unwatchSandbox', () => {
    test('cleans up state', async () => {
      client.raw.watchSandbox.mockReturnValue(neverEndingStream());

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      watcher.unwatchSandbox('sandbox-1');

      // Should not throw for non-existent sandbox
      watcher.unwatchSandbox('sandbox-1');
    });
  });

  describe('unwatchSandboxByName', () => {
    test('unwatches sandbox found by name', async () => {
      client.raw.watchSandbox.mockReturnValue(neverEndingStream());

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      watcher.unwatchSandboxByName('my-sandbox');

      // Should be able to watch again after unwatching by name
      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      expect(client.raw.watchSandbox).toHaveBeenCalledTimes(2);
    });

    test('is a no-op when sandbox name not found', () => {
      watcher.unwatchSandboxByName('nonexistent');
    });
  });

  describe('log-based denial detection', () => {
    function makeLogEvent(
      message: string,
      fields: Record<string, string> = {},
    ): {
      payload: {
        case: 'log';
        value: { fields: Record<string, string>; timestampMs: bigint; message: string; level: string; source: string };
      };
    } {
      return {
        payload: {
          case: 'log' as const,
          value: { fields, timestampMs: BigInt(Date.now()), message, level: 'INFO', source: 'sandbox' },
        },
      };
    }

    function setupStreamWithEvents(
      events: Array<{ payload: { case: string; value: unknown } }>,
    ): AsyncGenerator<{ payload: { case: string; value: unknown } }> {
      return (async function* (): AsyncGenerator<{ payload: { case: string; value: unknown } }> {
        for (const ev of events) {
          yield ev;
        }
        await new Promise(() => {});
      })();
    }

    test('emits L4 denial immediately from OCSF shorthand', async () => {
      const logEvent = makeLogEvent(
        'NET:CONNECT [MED] DENIED curl(1234) -> registry.npmjs.org:443 [policy:default] [reason:host not in allow list]',
      );
      client.raw.watchSandbox.mockReturnValue(setupStreamWithEvents([logEvent]));

      const events: DraftPolicyEvent[] = [];
      watcher.onDraftPolicyUpdate(e => events.push(e));

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      await vi.advanceTimersByTimeAsync(0);

      expect(events).toHaveLength(1);
      const chunk = events[0]!.chunks[0]!;
      expect(chunk.host).toBe('registry.npmjs.org');
      expect(chunk.port).toBe(443);
      expect(chunk.isL7).toBe(false);
      expect(chunk.status).toBe('pending');
    });

    test('emits L7 denial immediately from OCSF shorthand', async () => {
      const logEvent = makeLogEvent(
        'HTTP:POST [MED] DENIED curl(1234) -> POST https://api.github.com:443/repos/octocat/hello-world/issues [policy:default] [reason:method/path not in allow list]',
      );
      client.raw.watchSandbox.mockReturnValue(setupStreamWithEvents([logEvent]));

      const events: DraftPolicyEvent[] = [];
      watcher.onDraftPolicyUpdate(e => events.push(e));

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      await vi.advanceTimersByTimeAsync(0);

      expect(events).toHaveLength(1);
      const chunk = events[0]!.chunks[0]!;
      expect(chunk.host).toBe('api.github.com');
      expect(chunk.port).toBe(443);
      expect(chunk.isL7).toBe(true);
      expect(chunk.method).toBe('POST');
      expect(chunk.status).toBe('pending');
    });

    test('does not emit duplicate denial when host:port already covered', async () => {
      const pendingChunk = {
        id: 'chunk-1',
        status: 'pending',
        ruleName: 'allow-api-github',
        proposedRule: {
          endpoints: [{ host: 'api.github.com', port: 443 }],
          binaries: [],
        },
        rationale: 'L4 CONNECT denied',
        securityNotes: '',
        confidence: 0.9,
      };
      client.raw.getDraftPolicy.mockResolvedValue({ chunks: [pendingChunk] });

      const logEvent = makeLogEvent(
        'HTTP:POST [MED] DENIED curl(1234) -> POST https://api.github.com:443/repos/octocat/hello-world/issues [policy:default]',
      );
      client.raw.watchSandbox.mockReturnValue(setupStreamWithEvents([logEvent]));

      const events: DraftPolicyEvent[] = [];
      watcher.onDraftPolicyUpdate(e => events.push(e));

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      await vi.advanceTimersByTimeAsync(0);

      // Only the existing draft chunk, no duplicate from log
      expect(events).toHaveLength(1);
      expect(events[0]!.chunks[0]!.chunkId).toBe('chunk-1');
    });

    test('emits L4 denial immediately from structured fields', async () => {
      const logEvent = makeLogEvent('some log message', {
        l4_decision: 'deny',
        dst_host: 'registry.npmjs.org',
        dst_port: '443',
        binary: '/usr/bin/curl',
        l4_deny_reason: 'host not in allow list',
      });
      client.raw.watchSandbox.mockReturnValue(setupStreamWithEvents([logEvent]));

      const events: DraftPolicyEvent[] = [];
      watcher.onDraftPolicyUpdate(e => events.push(e));

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      await vi.advanceTimersByTimeAsync(0);

      expect(events).toHaveLength(1);
      const chunk = events[0]!.chunks[0]!;
      expect(chunk.host).toBe('registry.npmjs.org');
      expect(chunk.port).toBe(443);
      expect(chunk.isL7).toBe(false);
    });

    test('emits L7 denial immediately from structured fields', async () => {
      const logEvent = makeLogEvent('some log message', {
        l7_decision: 'deny',
        dst_host: 'api.github.com',
        dst_port: '443',
        l7_action: 'POST',
        l7_target: '/repos/octocat/hello-world/issues',
        l7_deny_reason: 'method/path not in allow list',
      });
      client.raw.watchSandbox.mockReturnValue(setupStreamWithEvents([logEvent]));

      const events: DraftPolicyEvent[] = [];
      watcher.onDraftPolicyUpdate(e => events.push(e));

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      await vi.advanceTimersByTimeAsync(0);

      expect(events).toHaveLength(1);
      const chunk = events[0]!.chunks[0]!;
      expect(chunk.host).toBe('api.github.com');
      expect(chunk.port).toBe(443);
      expect(chunk.isL7).toBe(true);
      expect(chunk.method).toBe('POST');
    });

    test('ignores transient policy-changed denials', async () => {
      const logEvent = makeLogEvent(
        'NET:CONNECT [MED] DENIED curl(1234) -> api.anthropic.com:443 [reason:L7 tunnel closed before inspection because policy changed while CONNECT was dialing upstream [captured_generation:2 current_generation:3]]',
      );
      client.raw.watchSandbox.mockReturnValue(setupStreamWithEvents([logEvent]));

      const events: DraftPolicyEvent[] = [];
      watcher.onDraftPolicyUpdate(e => events.push(e));

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      await vi.advanceTimersByTimeAsync(0);

      expect(events).toHaveLength(0);
    });

    test('ignores non-denial log lines', async () => {
      const logEvent = makeLogEvent('INFO some normal log message');
      client.raw.watchSandbox.mockReturnValue(setupStreamWithEvents([logEvent]));

      const events: DraftPolicyEvent[] = [];
      watcher.onDraftPolicyUpdate(e => events.push(e));

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      await vi.advanceTimersByTimeAsync(0);

      expect(events).toHaveLength(0);
    });

    test('emits L4 denial from NET:CONNECT with no arrow actor prefix', async () => {
      const logEvent = makeLogEvent('NET:CONNECT [HIGH] DENIED registry.npmjs.org:443 [reason:blocked]');
      client.raw.watchSandbox.mockReturnValue(setupStreamWithEvents([logEvent]));

      const events: DraftPolicyEvent[] = [];
      watcher.onDraftPolicyUpdate(e => events.push(e));

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      await vi.advanceTimersByTimeAsync(0);

      expect(events).toHaveLength(1);
      expect(events[0]!.chunks[0]!.host).toBe('registry.npmjs.org');
      expect(events[0]!.chunks[0]!.port).toBe(443);
      expect(events[0]!.chunks[0]!.isL7).toBe(false);
    });
  });

  describe('sandbox state change triggers draft refetch', () => {
    test('refetches draft policy on sandbox state event', async () => {
      const sandboxEvent = {
        payload: {
          case: 'sandbox' as const,
          value: { status: 'running' },
        },
      };

      client.raw.watchSandbox.mockReturnValue(
        (async function* (): AsyncGenerator<{ payload: { case: string; value: unknown } }> {
          yield sandboxEvent;
          await new Promise(() => {});
        })(),
      );

      // First getDraftPolicy call (on initial connect) returns empty
      // Second call (after sandbox state change) returns a chunk
      client.raw.getDraftPolicy.mockResolvedValueOnce({ chunks: [] }).mockResolvedValueOnce({
        chunks: [
          {
            id: 'chunk-new',
            status: 'pending',
            ruleName: 'allow-new',
            proposedRule: {
              endpoints: [{ host: 'pypi.org', port: 443 }],
              binaries: [],
            },
            rationale: 'L4 denied',
            securityNotes: '',
            confidence: 0.8,
          },
        ],
      });

      const events: DraftPolicyEvent[] = [];
      watcher.onDraftPolicyUpdate(e => events.push(e));

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      await vi.advanceTimersByTimeAsync(0);

      expect(events).toHaveLength(1);
      expect(events[0]!.chunks[0]!.host).toBe('pypi.org');
      expect(client.raw.getDraftPolicy).toHaveBeenCalledTimes(2);
    });
  });

  describe('policyChunkToFlowChunk mapping', () => {
    test('maps PolicyChunk fields correctly', async () => {
      const pendingChunk = {
        id: 'chunk-42',
        status: 'pending',
        ruleName: 'allow-api-github',
        proposedRule: {
          endpoints: [{ host: 'api.github.com', port: 443 }],
          binaries: [{ path: '/usr/bin/git' }, { path: '/usr/bin/curl' }],
        },
        rationale: 'L4 CONNECT denied',
        securityNotes: 'May expose credentials',
        confidence: 0.7,
      };
      client.raw.getDraftPolicy.mockResolvedValue({ chunks: [pendingChunk] });
      client.raw.watchSandbox.mockReturnValue(neverEndingStream());

      const events: DraftPolicyEvent[] = [];
      watcher.onDraftPolicyUpdate(e => events.push(e));

      await watcher.watchSandbox('sandbox-1', 'my-sandbox');
      await vi.advanceTimersByTimeAsync(0);

      const chunk = events[0]!.chunks[0]!;
      expect(chunk.chunkId).toBe('chunk-42');
      expect(chunk.ruleName).toBe('allow-api-github');
      expect(chunk.status).toBe('pending');
      expect(chunk.host).toBe('api.github.com');
      expect(chunk.port).toBe(443);
      expect(chunk.binaries).toEqual(['/usr/bin/git', '/usr/bin/curl']);
      expect(chunk.rationale).toBe('L4 CONNECT denied');
      expect(chunk.hasSecurityNotes).toBe(true);
      expect(chunk.isL7).toBe(false);
    });
  });
});
