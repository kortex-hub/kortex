<script lang="ts">
import { faBan, faCheck, faExclamationTriangle, faShieldAlt } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';

import type { AcpFlowDraftPolicyEvent } from '/@api/acp-session-info';

interface Props {
  event: AcpFlowDraftPolicyEvent;
  sessionId: string;
}

let { event, sessionId }: Props = $props();
let responding = $state<string | undefined>(undefined);
let errorByChunk = $state<Record<string, string>>({});

async function handleApprove(chunkId: string): Promise<void> {
  if (responding) return;
  responding = chunkId;
  errorByChunk[chunkId] = '';
  try {
    await window.approveDraftChunk(sessionId, chunkId);
  } catch (err: unknown) {
    console.error('Failed to approve draft chunk', err);
    errorByChunk[chunkId] = err instanceof Error ? err.message : String(err);
  } finally {
    responding = undefined;
  }
}

async function handleReject(chunkId: string): Promise<void> {
  if (responding) return;
  responding = chunkId;
  errorByChunk[chunkId] = '';
  try {
    await window.rejectDraftChunk(sessionId, chunkId);
  } catch (err: unknown) {
    console.error('Failed to reject draft chunk', err);
    errorByChunk[chunkId] = err instanceof Error ? err.message : String(err);
  } finally {
    responding = undefined;
  }
}
</script>

{#each event.chunks as chunk (chunk.chunkId)}
  <div class="network-block rounded-[10px] overflow-hidden" class:network-block-pending={chunk.status === 'pending'} class:network-block-resolved={chunk.status !== 'pending'}>
    <!-- Header -->
    <div class="network-block-header flex items-center gap-2.5 px-4 py-3">
      <div class="network-block-icon flex items-center justify-center w-8 h-8 rounded-lg shrink-0">
        <Icon icon={faShieldAlt} class="text-[var(--pd-status-dead)] text-sm" />
      </div>
      <div class="flex flex-col flex-1 min-w-0 gap-0.5">
        <span class="text-[13px] font-semibold text-[var(--pd-status-dead)]">Network request blocked</span>
        <span class="text-[11px] text-[var(--pd-content-text)] opacity-50">
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>

    <!-- Body -->
    <div class="px-4 py-3.5">
      <p class="text-[13px] text-[var(--pd-content-text)] leading-relaxed mb-3.5">
        The agent attempted to reach <strong class="text-[var(--pd-status-dead)]">{chunk.host}</strong> but the request was denied by the workspace network policy.
      </p>

      <!-- Details -->
      <div class="network-block-details rounded-lg p-2.5 px-3.5 mb-3.5 flex flex-col gap-2">
        {#if chunk.protocol === 'graphql' && chunk.operationType}
          <div class="flex items-baseline gap-2.5 text-xs">
            <span class="text-[var(--pd-content-text)] opacity-50 font-medium w-[72px] shrink-0">Request</span>
            <code class="text-[var(--pd-content-text)] bg-[var(--pd-content-card-hover-bg)] px-1.5 py-0.5 rounded text-[11px]">
              GraphQL {chunk.operationType}{chunk.operationName ? ` ${chunk.operationName}` : ''}{chunk.graphqlFields?.length ? ` (${chunk.graphqlFields.join(', ')})` : ''}
            </code>
          </div>
          <div class="flex items-baseline gap-2.5 text-xs">
            <span class="text-[var(--pd-content-text)] opacity-50 font-medium w-[72px] shrink-0">Host</span>
            <code class="text-[var(--pd-content-text)] bg-[var(--pd-content-card-hover-bg)] px-1.5 py-0.5 rounded text-[11px]">
              {chunk.host}:{chunk.port}
            </code>
          </div>
        {:else if chunk.isL7 && chunk.method && chunk.path}
          <div class="flex items-baseline gap-2.5 text-xs">
            <span class="text-[var(--pd-content-text)] opacity-50 font-medium w-[72px] shrink-0">Request</span>
            <code class="text-[var(--pd-content-text)] bg-[var(--pd-content-card-hover-bg)] px-1.5 py-0.5 rounded text-[11px]">
              {chunk.method} {chunk.host}:{chunk.port}{chunk.path}
            </code>
          </div>
        {:else}
          <div class="flex items-baseline gap-2.5 text-xs">
            <span class="text-[var(--pd-content-text)] opacity-50 font-medium w-[72px] shrink-0">Host</span>
            <code class="text-[var(--pd-content-text)] bg-[var(--pd-content-card-hover-bg)] px-1.5 py-0.5 rounded text-[11px]">
              {chunk.host}:{chunk.port}
            </code>
          </div>
        {/if}
        {#if chunk.rationale}
          <div class="flex items-baseline gap-2.5 text-xs">
            <span class="text-[var(--pd-content-text)] opacity-50 font-medium w-[72px] shrink-0">Reason</span>
            <span class="text-[var(--pd-content-text)]">{chunk.rationale}</span>
          </div>
        {/if}
        <div class="flex items-baseline gap-2.5 text-xs">
          <span class="text-[var(--pd-content-text)] opacity-50 font-medium w-[72px] shrink-0">Policy</span>
          <span class="text-[var(--pd-content-text)]">
            <span class="network-policy-badge-deny inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">Deny</span>
            {#if chunk.protocol === 'graphql'}
              — operation not in allow list
            {:else if chunk.isL7}
              — method/path not in allow list
            {:else}
              — host not in allowed list
            {/if}
          </span>
        </div>
      </div>

      <!-- Security warning -->
      {#if chunk.hasSecurityNotes}
        <div class="flex items-center gap-1.5 text-xs text-[var(--pd-status-waiting)] mb-3.5">
          <Icon icon={faExclamationTriangle} class="text-xs" />
          <span>This rule has security considerations — review carefully before approving.</span>
        </div>
      {/if}

      <!-- Actions -->
      {#if chunk.status === 'pending'}
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <Button
              type="primary"
              onclick={(): void => { handleApprove(chunk.chunkId).catch((e: unknown) => console.error(e)); }}
              disabled={responding === chunk.chunkId}
            >
              Allow {chunk.host}{chunk.protocol === 'graphql' && chunk.operationType ? ` (${chunk.operationType})` : chunk.isL7 && chunk.method ? ` (${chunk.method})` : ''}
            </Button>
            <Button
              type="secondary"
              onclick={(): void => { handleReject(chunk.chunkId).catch((e: unknown) => console.error(e)); }}
              disabled={responding === chunk.chunkId}
            >
              Reject
            </Button>
          </div>
          {#if errorByChunk[chunk.chunkId]}
            <div class="flex items-start gap-1.5 text-xs text-[var(--pd-status-dead)]">
              <Icon icon={faExclamationTriangle} class="text-xs mt-0.5 shrink-0" />
              <span>Failed to update policy: {errorByChunk[chunk.chunkId]}</span>
            </div>
          {/if}
        </div>
      {:else if chunk.status === 'approved'}
        <div class="flex items-center gap-1.5 text-xs">
          <Icon icon={faCheck} class="text-[var(--pd-status-running)] text-xs" />
          <span class="text-[var(--pd-status-running)]">Approved — policy updated</span>
        </div>
      {:else if chunk.status === 'rejected'}
        <div class="flex items-center gap-1.5 text-xs">
          <Icon icon={faBan} class="text-[var(--pd-status-dead)] text-xs" />
          <span class="text-[var(--pd-status-dead)]">Rejected</span>
        </div>
      {/if}
    </div>
  </div>
{/each}

<style>
  .network-block {
    margin: 4px 0 20px;
  }
  .network-block-pending {
    border: 1px solid color-mix(in srgb, var(--pd-status-dead) 25%, transparent);
    background: color-mix(in srgb, var(--pd-status-dead) 4%, transparent);
  }
  .network-block-resolved {
    border: 1px solid var(--pd-content-divider);
    background: var(--pd-content-card-bg);
  }
  .network-block-header {
    background: color-mix(in srgb, var(--pd-status-dead) 6%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--pd-status-dead) 12%, transparent);
  }
  .network-block-resolved .network-block-header {
    background: var(--pd-content-card-bg);
    border-bottom-color: var(--pd-content-divider);
  }
  .network-block-icon {
    background: color-mix(in srgb, var(--pd-status-dead) 12%, transparent);
  }
  .network-block-details {
    background: color-mix(in srgb, black 20%, transparent);
    border: 1px solid color-mix(in srgb, white 6%, transparent);
  }
  .network-policy-badge-deny {
    background: color-mix(in srgb, var(--pd-status-dead) 15%, transparent);
    color: var(--pd-status-dead);
  }
</style>
