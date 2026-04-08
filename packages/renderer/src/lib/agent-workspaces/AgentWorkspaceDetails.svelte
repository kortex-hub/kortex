<script lang="ts">
import { faPlay, faStop, faTrash } from '@fortawesome/free-solid-svg-icons';
import { ErrorMessage, Tab } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';

import AgentWorkspaceDetailsSummary from '/@/lib/agent-workspaces/AgentWorkspaceDetailsSummary.svelte';
import { withConfirmation } from '/@/lib/dialogs/messagebox-utils';
import DetailsPage from '/@/lib/ui/DetailsPage.svelte';
import ListItemButtonIcon from '/@/lib/ui/ListItemButtonIcon.svelte';
import { getTabUrl, isTabSelected } from '/@/lib/ui/Util';
import Route from '/@/Route.svelte';
import type { AgentWorkspaceStatus } from '/@/stores/agent-workspaces.svelte';
import {
  agentWorkspaces,
  agentWorkspaceStatuses,
  startAgentWorkspace,
  stopAgentWorkspace,
} from '/@/stores/agent-workspaces.svelte';

interface Props {
  workspaceId: string;
}

let { workspaceId }: Props = $props();

let configuration: Awaited<ReturnType<typeof window.getAgentWorkspaceConfiguration>> = $state({});
let configurationError: string | undefined = $state(undefined);

const workspaceSummary = $derived($agentWorkspaces.find(ws => ws.id === workspaceId));

const status: AgentWorkspaceStatus = $derived(agentWorkspaceStatuses.get(workspaceId) ?? 'stopped');
const isRunning = $derived(status === 'running' || status === 'stopping');
const inProgress = $derived(status === 'starting' || status === 'stopping');

$effect(() => {
  window
    .getAgentWorkspaceConfiguration(workspaceId)
    .then(config => {
      configuration = config;
      configurationError = undefined;
    })
    .catch((err: unknown) => {
      configurationError = String(err);
    });
});

async function handleStartStop(): Promise<void> {
  if (inProgress) return;
  const name = workspaceSummary?.name ?? workspaceId;
  try {
    if (isRunning) {
      await stopAgentWorkspace(workspaceId);
    } else {
      await startAgentWorkspace(workspaceId);
    }
  } catch (error: unknown) {
    const action = isRunning ? 'stopping' : 'starting';
    await window.showMessageBox({
      title: 'Agent Workspace',
      type: 'error',
      message: `Error while ${action} workspace "${name}": ${error}`,
      buttons: ['OK'],
    });
  }
}

function handleRemove(): void {
  withConfirmation(
    async () => {
      try {
        await window.removeAgentWorkspace(workspaceId);
        router.goto('/agent-workspaces');
      } catch (error: unknown) {
        console.error('Failed to remove agent workspace', error);
      }
    },
    `remove workspace ${workspaceSummary?.name ?? workspaceId}`,
  );
}
</script>

<DetailsPage title={workspaceSummary?.name ?? ''}>
  {#snippet actionsSnippet()}
    <ListItemButtonIcon
      title={isRunning ? 'Stop Workspace' : 'Start Workspace'}
      onClick={handleStartStop}
      icon={isRunning ? faStop : faPlay}
      inProgress={inProgress} />
    <ListItemButtonIcon
      title="Remove Workspace"
      onClick={handleRemove}
      icon={faTrash} />
  {/snippet}
  {#snippet tabsSnippet()}
    <Tab title="Summary" selected={isTabSelected($router.path, 'summary')} url={getTabUrl($router.path, 'summary')} />
  {/snippet}
  {#snippet contentSnippet()}
    <Route path="/summary" breadcrumb="Summary" navigationHint="tab">
      {#if configurationError}
        <ErrorMessage error={configurationError} />
      {/if}
      <AgentWorkspaceDetailsSummary {workspaceSummary} {configuration} />
    </Route>
  {/snippet}
</DetailsPage>
