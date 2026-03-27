<script lang="ts">
import { faKey, faPlay, faStop, faTrash } from '@fortawesome/free-solid-svg-icons';
import { ErrorMessage, Spinner, Tab } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';
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

function handleStartStop(): void {
  if (inProgress) return;
  if (isRunning) {
    stopAgentWorkspace(workspaceId).catch(console.error);
  } else {
    startAgentWorkspace(workspaceId).catch(console.error);
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
        {inProgress} />
      <ListItemButtonIcon title="Remove Workspace" onClick={handleRemove} icon={faTrash} />
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
            {#if workspaceSummary?.agent}
              <tr>
                <DetailsCell>Agent</DetailsCell>
                <DetailsCell>{workspaceSummary.agent}</DetailsCell>
              </tr>
            {/if}

            {#if configuration.mounts?.dependencies?.length ?? configuration.mounts?.configs?.length}
              <tr>
                <DetailsTitle>Mounts</DetailsTitle>
              </tr>
              {#if configuration.mounts?.dependencies?.length}
                <tr>
                  <DetailsCell>Dependencies</DetailsCell>
                  <DetailsCell>
                    {#each configuration.mounts.dependencies as dep (dep)}
                      <span class="block">{dep}</span>
                    {/each}
                  </DetailsCell>
                </tr>
              {/if}
              {#if configuration.mounts?.configs?.length}
                <tr>
                  <DetailsCell>Configs</DetailsCell>
                  <DetailsCell>
                    {#each configuration.mounts.configs as cfg (cfg)}
                      <span class="block">{cfg}</span>
                    {/each}
                  </DetailsCell>
                </tr>
              {/if}
            {/if}

            {#if configuration.environment?.length}
              <tr>
                <DetailsTitle>Environment</DetailsTitle>
              </tr>
              {#each configuration.environment as envVar (envVar.name)}
                <tr>
                  <DetailsCell>{envVar.name}</DetailsCell>
                  <DetailsCell>
                    {#if envVar.secret}
                      <span class="inline-flex items-center gap-1">
                        <Icon icon={faKey} class="shrink-0 opacity-70" />
                        {envVar.secret}
                      </span>
                    {:else}
                      {envVar.value ?? ''}
                    {/if}
                  </DetailsCell>
                </tr>
              {/each}
            {/if}
          </DetailsTable>
        </div>
      </Route>
    {/snippet}
  </DetailsPage>
{:catch error}
  <ErrorMessage error={String(error)} />
{/await}
