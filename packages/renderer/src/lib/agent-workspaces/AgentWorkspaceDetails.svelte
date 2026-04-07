<script lang="ts">
import { faPlay, faStop, faTrash } from '@fortawesome/free-solid-svg-icons';
import { ErrorMessage, Spinner, Tab } from '@podman-desktop/ui-svelte';
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

const configurationPromise = $derived(window.getAgentWorkspaceConfiguration(workspaceId));
const workspaceSummary = $derived($agentWorkspaces.find(ws => ws.id === workspaceId));

const status: AgentWorkspaceStatus = $derived(agentWorkspaceStatuses.get(workspaceId) ?? 'stopped');
const isRunning = $derived(status === 'running' || status === 'stopping');
const inProgress = $derived(status === 'starting' || status === 'stopping');

function handleStartStop(): void {
  if (inProgress) return;
  if (isRunning) {
    stopAgentWorkspace(workspaceId).catch(console.error);
  } else {
    startAgentWorkspace(workspaceId).catch(console.error);
  }
}

function handleRemove(name: string): void {
  withConfirmation(async () => {
    try {
      await window.removeAgentWorkspace(workspaceId);
      router.goto('/agent-workspaces');
    } catch (error: unknown) {
      console.error('Failed to remove agent workspace', error);
    }
  }, `remove workspace ${name}`);
}
</script>

{#await configurationPromise}
  <div class="flex items-center justify-center h-full">
    <Spinner />
  </div>
{:then configuration}
  <DetailsPage title={workspaceSummary?.name ?? ''}>
    {#snippet actionsSnippet()}
      <ListItemButtonIcon
        title={isRunning ? 'Stop Workspace' : 'Start Workspace'}
        onClick={handleStartStop}
        icon={isRunning ? faStop : faPlay}
        inProgress={inProgress} />
      <ListItemButtonIcon
        title="Remove Workspace"
        onClick={handleRemove.bind(undefined, workspaceSummary?.name ?? '')}
        icon={faTrash} />
    {/snippet}
    {#snippet tabsSnippet()}
      <Tab title="Summary" selected={isTabSelected($router.path, 'summary')} url={getTabUrl($router.path, 'summary')} />
    {/snippet}
    {#snippet contentSnippet()}
      <Route path="/summary" breadcrumb="Summary" navigationHint="tab">
        <AgentWorkspaceDetailsSummary {workspaceSummary} {configuration} />
      </Route>
    {/snippet}
  </DetailsPage>
{:catch error}
  <ErrorMessage error={String(error)} />
{/await}
