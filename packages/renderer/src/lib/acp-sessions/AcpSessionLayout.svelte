<script lang="ts">
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';
import type { Snippet } from 'svelte';
import { router } from 'tinro';

import { acpSessions } from '/@/stores/acp-sessions.svelte';
import { allOpenshellSandboxes } from '/@/stores/openshell-sandboxes';
import type { AcpSessionInfo, AcpSessionStatus } from '/@api/acp-session-info';

import AcpSessionCreate from './AcpSessionCreate.svelte';

interface Props {
  currentSessionId?: string;
  children: Snippet;
}

let { currentSessionId, children }: Props = $props();
let showCreateDialog = $state(false);

const hasReadySandboxes = $derived($allOpenshellSandboxes.some(s => s.phase === 'Ready'));

const STATUS_COLORS: Record<AcpSessionStatus, string> = {
  idle: 'bg-[var(--pd-status-not-running)]',
  running: 'bg-[var(--pd-status-running)]',
  waiting_input: 'bg-[var(--pd-status-waiting)]',
  completed: 'bg-[var(--pd-status-terminated)]',
  error: 'bg-[var(--pd-status-dead)]',
  cancelled: 'bg-[var(--pd-status-not-running)]',
};

const needsInputSessions: AcpSessionInfo[] = $derived($acpSessions.filter(s => s.status === 'waiting_input'));
const runningSessions: AcpSessionInfo[] = $derived(
  $acpSessions.filter(s => s.status === 'running' || s.status === 'idle'),
);
const completedSessions: AcpSessionInfo[] = $derived(
  $acpSessions.filter(s => s.status === 'completed' || s.status === 'cancelled' || s.status === 'error'),
);

function navigateToSession(id: string): void {
  router.goto(`/acp-sessions/${encodeURIComponent(id)}`);
}

function truncatePrompt(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function handleDeleteSession(e: MouseEvent, id: string): Promise<void> {
  e.stopPropagation();
  try {
    await window.deleteAcpSession(id);
    if (id === currentSessionId) {
      router.goto('/acp-sessions');
    }
  } catch (err: unknown) {
    console.error('Failed to delete session', err);
  }
}
</script>

<div class="flex h-full w-full bg-[var(--pd-content-bg)]">
  <!-- Session list sidebar -->
  <div class="w-64 shrink-0 flex flex-col border-r border-[var(--pd-content-divider)] bg-[var(--pd-content-card-bg)]">
    <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--pd-content-divider)]">
      <span class="text-xs font-semibold uppercase tracking-wider text-[var(--pd-content-header-text)]">Sessions</span>
      <Button icon={faPlus} type="link" padding="p-0.5" disabled={!hasReadySandboxes} onclick={(): void => { showCreateDialog = true; }} title="New Session" />
    </div>
    <div class="flex-1 overflow-auto">
      {#if needsInputSessions.length > 0}
        <div class="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-[var(--pd-status-waiting)]">
          Needs your input <span class="opacity-70">{needsInputSessions.length}</span>
        </div>
        {#each needsInputSessions as s (s.id)}
          <div class="group flex items-center hover:bg-[var(--pd-content-card-hover-bg)] transition-colors
            {s.id === currentSessionId ? 'bg-[var(--pd-content-card-inset-bg)] border-l-2 border-l-[var(--pd-button-primary-bg)]' : 'border-l-2 border-l-transparent'}">
            <button
              class="flex items-center gap-2 flex-1 min-w-0 px-3 py-2 text-left text-sm"
              onclick={(): void => navigateToSession(s.id)}
            >
              <span class="w-2 h-2 rounded-full shrink-0 {STATUS_COLORS[s.status]}"></span>
              <span class="truncate text-[var(--pd-content-text)]">{truncatePrompt(s.prompt, 40)}</span>
            </button>
            <button
              class="shrink-0 p-1.5 mr-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-[var(--pd-status-dead)] transition-opacity"
              title="Delete session"
              onclick={(e: MouseEvent): void => { handleDeleteSession(e, s.id).catch((err: unknown) => console.error(err)); }}
            >
              <Icon icon={faTrash} class="text-[10px]" />
            </button>
          </div>
        {/each}
      {/if}

      {#if runningSessions.length > 0}
        <div class="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-[var(--pd-status-running)]">
          Running <span class="opacity-70">{runningSessions.length}</span>
        </div>
        {#each runningSessions as s (s.id)}
          <div class="group flex items-center hover:bg-[var(--pd-content-card-hover-bg)] transition-colors
            {s.id === currentSessionId ? 'bg-[var(--pd-content-card-inset-bg)] border-l-2 border-l-[var(--pd-button-primary-bg)]' : 'border-l-2 border-l-transparent'}">
            <button
              class="flex items-center gap-2 flex-1 min-w-0 px-3 py-2 text-left text-sm"
              onclick={(): void => navigateToSession(s.id)}
            >
              <span class="w-2 h-2 rounded-full shrink-0 {STATUS_COLORS[s.status]}"></span>
              <span class="truncate text-[var(--pd-content-text)]">{truncatePrompt(s.prompt, 40)}</span>
            </button>
            <button
              class="shrink-0 p-1.5 mr-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-[var(--pd-status-dead)] transition-opacity"
              title="Delete session"
              onclick={(e: MouseEvent): void => { handleDeleteSession(e, s.id).catch((err: unknown) => console.error(err)); }}
            >
              <Icon icon={faTrash} class="text-[10px]" />
            </button>
          </div>
        {/each}
      {/if}

      {#if completedSessions.length > 0}
        <div class="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-[var(--pd-content-text)] opacity-50">
          Completed <span class="opacity-70">{completedSessions.length}</span>
        </div>
        {#each completedSessions as s (s.id)}
          <div class="group flex items-center hover:bg-[var(--pd-content-card-hover-bg)] transition-colors
            {s.id === currentSessionId ? 'bg-[var(--pd-content-card-inset-bg)] border-l-2 border-l-[var(--pd-button-primary-bg)]' : 'border-l-2 border-l-transparent'}">
            <button
              class="flex items-center gap-2 flex-1 min-w-0 px-3 py-2 text-left text-sm"
              onclick={(): void => navigateToSession(s.id)}
            >
              <span class="w-2 h-2 rounded-full shrink-0 {STATUS_COLORS[s.status]}"></span>
              <span class="truncate text-[var(--pd-content-text)]">{truncatePrompt(s.prompt, 40)}</span>
            </button>
            <button
              class="shrink-0 p-1.5 mr-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-[var(--pd-status-dead)] transition-opacity"
              title="Delete session"
              onclick={(e: MouseEvent): void => { handleDeleteSession(e, s.id).catch((err: unknown) => console.error(err)); }}
            >
              <Icon icon={faTrash} class="text-[10px]" />
            </button>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- Main content area -->
  <div class="flex flex-col flex-1 min-w-0 min-h-0">
    {@render children()}
  </div>
</div>

{#if showCreateDialog && hasReadySandboxes}
  <AcpSessionCreate onclose={(): void => { showCreateDialog = false; }} />
{/if}
