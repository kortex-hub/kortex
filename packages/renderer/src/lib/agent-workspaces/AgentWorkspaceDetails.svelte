<script lang="ts">
import { faArrowsRotate, faTerminal, faTrash } from '@fortawesome/free-solid-svg-icons';
import { ErrorMessage, Tab } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';

import AgentWorkspaceDetailsOverview from '/@/lib/agent-workspaces/AgentWorkspaceDetailsOverview.svelte';
import AgentWorkspaceDetailsSettings from '/@/lib/agent-workspaces/AgentWorkspaceDetailsSettings.svelte';
import AgentWorkspaceTerminal from '/@/lib/agent-workspaces/AgentWorkspaceTerminal.svelte';
import { withConfirmation } from '/@/lib/dialogs/messagebox-utils';
import DetailsPage from '/@/lib/ui/DetailsPage.svelte';
import ListItemButtonIcon from '/@/lib/ui/ListItemButtonIcon.svelte';
import { getTabUrl, isTabSelected } from '/@/lib/ui/Util';
import Route from '/@/Route.svelte';
import { removeTerminal } from '/@/stores/agent-workspace-terminal-store';
import { allOpenshellSandboxes } from '/@/stores/openshell-sandboxes';

interface Props {
  workspaceId: string;
}

let { workspaceId }: Props = $props();

let configuration: Awaited<ReturnType<typeof window.getAgentWorkspaceConfiguration>> = $state({});
let configurationError: string | undefined = $state(undefined);

const workspaceSummary = $derived($allOpenshellSandboxes.find(ws => ws.id === workspaceId));

const status = $derived(workspaceSummary?.phase ?? 'Provisioning');
const isRunning = $derived(status === 'Ready' || status === 'Deleting');
const inProgress = $derived(status === 'Provisioning' || status === 'Deleting');

let terminalReconnectExhausted = $state(false);
let terminalReconnect: (() => void) | undefined = $state(undefined);
const isOnTerminalTab = $derived(isTabSelected($router.path, 'terminal'));

$effect(() => {
  if (status === 'Unknown') {
    removeTerminal(workspaceId);
  }
});

$effect(() => {
  configurationError = undefined;
  let current = true;
  window
    .getAgentWorkspaceConfiguration(workspaceId)
    .then(config => {
      if (current) configuration = config;
    })
    .catch((err: unknown) => {
      if (current) configurationError = String(err);
    });
  return (): void => {
    current = false;
  };
});

async function handleTerminal(): Promise<void> {
  if (!isRunning && !inProgress) {
    await window.showMessageBox({
      title: 'Agent Workspace',
      type: 'error',
      message: `Error can't open terminal on workspace "${workspaceSummary?.name}"`,
      buttons: ['OK'],
    });
  }
  router.goto(`/agent-workspaces/${encodeURIComponent(workspaceId)}/terminal`);
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
    {#if isOnTerminalTab && isRunning && terminalReconnectExhausted && terminalReconnect}
      <ListItemButtonIcon
        title="Reconnect"
        onClick={terminalReconnect}
        icon={faArrowsRotate} />
    {/if}
    <ListItemButtonIcon
      title="Open Terminal"
      onClick={handleTerminal}
      icon={faTerminal} />
    <ListItemButtonIcon
      title="Remove Workspace"
      onClick={handleRemove}
      icon={faTrash} />
  {/snippet}
  {#snippet tabsSnippet()}
    <Tab title="Overview" selected={isTabSelected($router.path, 'overview')} url={getTabUrl($router.path, 'overview')} />
    <Tab title="Terminal" selected={isTabSelected($router.path, 'terminal')} url={getTabUrl($router.path, 'terminal')} />
    <!-- <Tab title="Files" selected={isTabSelected($router.path, 'files')} url={getTabUrl($router.path, 'files')} /> -->
    <Tab title="Settings" selected={isTabSelected($router.path, 'settings')} url={getTabUrl($router.path, 'settings')} />
  {/snippet}
  {#snippet contentSnippet()}
    <Route path="/overview" breadcrumb="Overview" navigationHint="tab">
      {#if configurationError}
        <ErrorMessage error={configurationError} />
      {/if}
      <AgentWorkspaceDetailsOverview {workspaceSummary} {configuration} />
    </Route>
    <Route path="/terminal" breadcrumb="Terminal" navigationHint="tab">
      <AgentWorkspaceTerminal
        workspaceId={workspaceId}
        bind:reconnectExhausted={terminalReconnectExhausted}
        bind:reconnect={terminalReconnect} />
    </Route>
    <!-- <Route path="/files" breadcrumb="Files" navigationHint="tab">
      <AgentWorkspaceDetailsFiles />
    </Route> -->
    <Route path="/settings" breadcrumb="Settings" navigationHint="tab">
      <AgentWorkspaceDetailsSettings {workspaceId} {workspaceSummary} bind:configuration />
    </Route>
  {/snippet}
</DetailsPage>
