<script lang="ts">
import { faFolder, faGear, faPlay, faStop, faTrash } from '@fortawesome/free-solid-svg-icons';
import { Icon } from '@podman-desktop/ui-svelte/icons';
import { router } from 'tinro';

import { withConfirmation } from '/@/lib/dialogs/messagebox-utils';
import LoadingIcon from '/@/lib/ui/LoadingIcon.svelte';
import type { AgentWorkspaceStatus } from '/@/stores/agent-workspaces';
import {
  agentWorkspaceStatuses,
  fetchAgentWorkspaces,
  startAgentWorkspace,
  stopAgentWorkspace,
} from '/@/stores/agent-workspaces';
import type { AgentWorkspaceSummary } from '/@api/agent-workspace-info';

interface Props {
  workspace: AgentWorkspaceSummary;
}

let { workspace }: Props = $props();

const status: AgentWorkspaceStatus = $derived($agentWorkspaceStatuses.get(workspace.id) ?? 'stopped');
const isRunning = $derived(status === 'running' || status === 'stopping');
const inProgress = $derived(status === 'starting' || status === 'stopping');

function handleOpen(): void {
  router.goto(`/agent-workspaces/${encodeURIComponent(workspace.id)}/summary`);
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleOpen();
  }
}

function handleActionKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' || e.key === ' ') {
    e.stopPropagation();
  }
}

function handleStartStopClick(e: MouseEvent): void {
  e.stopPropagation();
  handleStartStop();
}

function handleStartStop(): void {
  if (inProgress) return;
  if (isRunning) {
    stopAgentWorkspace(workspace.id).catch(console.error);
  } else {
    startAgentWorkspace(workspace.id).catch(console.error);
  }
}

function handleRemoveClick(e: MouseEvent): void {
  e.stopPropagation();
  handleRemove();
}

function handleRemove(): void {
  withConfirmation(
    () => window.removeAgentWorkspace(workspace.id).then(fetchAgentWorkspaces).catch(console.error),
    `remove workspace ${workspace.name}`,
  );
}
</script>

<div
  class="flex flex-col gap-3 p-4 bg-(--pd-content-card-carousel-card-bg) hover:bg-(--pd-content-card-carousel-card-hover-bg) rounded-md cursor-pointer"
  role="button"
  aria-label="workspace {workspace.name}"
  onclick={handleOpen}
  onkeydown={handleKeydown}
  tabindex="0">
  <div class="text-start">
    <span class="text-(--pd-invert-content-card-text) font-semibold text-base">{workspace.name}</span>
  </div>
  <div class="flex flex-col gap-2 text-sm">
    <div class="flex items-center gap-2 text-(--pd-invert-content-card-text)" title={workspace.paths.source}>
      <Icon icon={faFolder} class="shrink-0 opacity-70" />
      <span class="truncate">{workspace.paths.source}</span>
    </div>
    <div class="flex items-center gap-2 text-(--pd-invert-content-card-text)" title={workspace.paths.configuration}>
      <Icon icon={faGear} class="shrink-0 opacity-70" />
      <span class="truncate">{workspace.paths.configuration}</span>
    </div>
  </div>
  <div class="flex justify-end gap-1">
    <button
      onclick={handleStartStopClick}
      onkeydown={handleActionKeydown}
      class="inline-flex items-center justify-center w-7 h-7 rounded-full text-(--pd-action-button-text) hover:bg-(--pd-action-button-hover-bg) hover:text-(--pd-action-button-hover-text) transition-colors"
      class:disabled={inProgress}
      disabled={inProgress}
      title={isRunning ? 'Stop workspace' : 'Start workspace'}
      aria-label="{isRunning ? 'Stop' : 'Start'} workspace {workspace.name}">
      <LoadingIcon icon={isRunning ? faStop : faPlay} loading={inProgress} />
    </button>
    <button
      onclick={handleRemoveClick}
      onkeydown={handleActionKeydown}
      class="inline-flex items-center justify-center w-7 h-7 rounded-full text-(--pd-action-button-text) hover:bg-(--pd-action-button-hover-bg) hover:text-(--pd-action-button-hover-text) transition-colors"
      title="Remove workspace"
      aria-label="Remove workspace {workspace.name}">
      <Icon icon={faTrash} />
    </button>
  </div>
</div>
