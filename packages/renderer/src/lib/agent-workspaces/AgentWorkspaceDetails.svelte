<script lang="ts">
import { faPlay, faStop, faTrash } from '@fortawesome/free-solid-svg-icons';
import { ErrorMessage, Spinner, Tab } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';

import DetailsCell from '/@/lib/details/DetailsCell.svelte';
import DetailsTable from '/@/lib/details/DetailsTable.svelte';
import DetailsTitle from '/@/lib/details/DetailsTitle.svelte';
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
  <DetailsPage title={configuration.name ?? ''}>
    {#snippet actionsSnippet()}
      <ListItemButtonIcon
        title={isRunning ? 'Stop Workspace' : 'Start Workspace'}
        onClick={handleStartStop}
        icon={isRunning ? faStop : faPlay}
        inProgress={inProgress} />
      <ListItemButtonIcon
        title="Remove Workspace"
        onClick={handleRemove.bind(undefined, configuration.name ?? '')}
        icon={faTrash} />
    {/snippet}
    {#snippet tabsSnippet()}
      <Tab title="Summary" selected={isTabSelected($router.path, 'summary')} url={getTabUrl($router.path, 'summary')} />
    {/snippet}
    {#snippet contentSnippet()}
      <Route path="/summary" breadcrumb="Summary" navigationHint="tab">
        <div class="h-min">
          <DetailsTable>
            <tr>
              <DetailsTitle>Workspace</DetailsTitle>
            </tr>
            {#if workspaceSummary?.project}
              <tr>
                <DetailsCell>Project</DetailsCell>
                <DetailsCell>{workspaceSummary.project}</DetailsCell>
              </tr>
            {/if}
            <tr>
              <DetailsTitle>Configuration</DetailsTitle>
            </tr>
            {#if configuration?.name}
              <tr>
                <DetailsCell>Name</DetailsCell>
                <DetailsCell>{configuration.name}</DetailsCell>
              </tr>
            {/if}
          </DetailsTable>
        </div>
      </Route>
    {/snippet}
  </DetailsPage>
{:catch error}
  <ErrorMessage error={String(error)} />
{/await}
