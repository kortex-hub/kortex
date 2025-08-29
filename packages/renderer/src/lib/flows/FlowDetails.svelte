<script lang="ts">
import { Button, Checkbox, Dropdown, Tab } from '@podman-desktop/ui-svelte';
import type { Terminal } from '@xterm/xterm';
import { onMount } from 'svelte';
import { router } from 'tinro';

import type { ModelInfo } from '/@/lib/chat/components/model-info';
import ModelSelector from '/@/lib/chat/components/model-selector.svelte';
import MonacoEditor from '/@/lib/editor/MonacoEditor.svelte';
import DetailsPage from '/@/lib/ui/DetailsPage.svelte';
import { getTabUrl, isTabSelected } from '/@/lib/ui/Util';
import Route from '/@/Route.svelte';
import { flowCurrentLogInfo } from '/@/stores/flow-current-log';
import { executeFlowsInfo } from '/@/stores/flows-execute';
import { providerInfos } from '/@/stores/providers';
import type { ProviderFlowConnectionInfo } from '/@api/provider-info';

import TerminalWindow from '../ui/TerminalWindow.svelte';
import FlowActions from './FlowActions.svelte';

interface Props {
  providerId: string;
  connectionName: string;
  flowId: string;
}

let { providerId, connectionName, flowId }: Props = $props();

let provider = $derived($providerInfos.find(provider => provider.id === providerId));
let connection: ProviderFlowConnectionInfo | undefined = $derived(
  provider?.flowConnections.find(connection => connection.name === connectionName),
);
let path = $derived(atob(flowId));

let flowInfo = $derived({
  providerId,
  id: flowId,
  path,
  connectionName,
});

let models: Array<ModelInfo> = $derived(
  $providerInfos.reduce(
    (accumulator, current) => {
      if (current.inferenceConnections.length > 0) {
        for (const { name, models } of current.inferenceConnections) {
          accumulator.push(
            ...models.map(model => ({
              providerId: current.id,
              connectionName: name,
              label: model.label,
            })),
          );
        }
      }
      return accumulator;
    },
    [] as Array<ModelInfo>,
  ),
);

let selectedModel = $state<ModelInfo | undefined>(undefined);

let kubernetes: string | undefined = $state(undefined);

let hideSecrets: boolean = $state(true);

let flowContent: string | undefined = $state(undefined);

const flowExecutions = $derived(
  $executeFlowsInfo.filter(
    flow => flow.flowInfo.connectionName === connectionName && flow.flowInfo.providerId === providerId,
  ),
);
let currentLogFlowId = $state('');
let logsTerminal: Terminal;

flowCurrentLogInfo.subscribe(log => {
  logsTerminal?.clear();
  logsTerminal?.write(log);
});

async function deployKubernetes(): Promise<void> {
  if (!selectedModel) return;
  if (!provider) return;
  if (!connection) return;

  const result = await window.flowDeployKubernetes(
    {
      model: selectedModel.label,
      providerId: selectedModel.providerId,
      connectionName: selectedModel.connectionName,
    },
    {
      flowId: flowId,
      providerId: provider.id,
      connectionName: connection.name,
    },
    {
      hideSecrets: hideSecrets,
      namespace: 'default',
    },
  );
  kubernetes = result;
}

onMount(() => {
  window
    .readFlow(providerId, connectionName, flowId)
    .then(content => {
      flowContent = content;
    })
    .catch(console.error);

  // when a new execute flow is added, select it
  executeFlowsInfo.subscribe(flows => {
    const matchingFlows = flows.filter(
      flow => flow.flowInfo.connectionName === connectionName && flow.flowInfo.providerId === providerId,
    );
    if (matchingFlows.length > 0) {
      const latestFlow = matchingFlows[matchingFlows.length - 1];
      if (latestFlow.taskId === currentLogFlowId) {
        return;
      }
      currentLogFlowId = latestFlow.taskId;
      onLogSelectedChange(currentLogFlowId).catch(console.error);
    }
  });
});

async function onLogSelectedChange(taskId: string): Promise<void> {
  logsTerminal?.clear();
  await window.flowDispatchLog(providerId, connectionName, flowId, taskId);
}
</script>

<DetailsPage title={path}>
  {#snippet tabsSnippet()}
    <Tab title="Summary" selected={isTabSelected($router.path, 'summary')} url={getTabUrl($router.path, 'summary')} />
    <Tab title="Source" selected={isTabSelected($router.path, 'source')} url={getTabUrl($router.path, 'source')} />
    {#if connection?.deploy?.kubernetes}
      <Tab title="Kube" selected={isTabSelected($router.path, 'kube')} url={getTabUrl($router.path, 'kube')} />
    {/if}
    {#if flowExecutions.length > 0 || isTabSelected($router.path, 'run') }
      <Tab title="Run ({flowExecutions.length})" selected={isTabSelected($router.path, 'run')} url={getTabUrl($router.path, 'run')} />
    {/if}

  {/snippet}
    {#snippet actionsSnippet()}
      <FlowActions object={flowInfo} />
    {/snippet}
  {#snippet contentSnippet()}
    <Route path="/summary" breadcrumb="Summary" navigationHint="tab">
      <ul>
        <li>{providerId} => {provider?.name}</li>
        <li>{connectionName} => {connection?.name}</li>
        <li>{flowId} => {path}</li>
      </ul>
    </Route>
    <Route path="/source" breadcrumb="Source" navigationHint="tab">
      <MonacoEditor content={flowContent} language="yaml" readOnly={true} />
    </Route>
    <Route path="/kube" breadcrumb="Kube" navigationHint="tab">
      <div class="flex flex-row gap-x-2 items-center">
        <ModelSelector class="" models={models} bind:value={selectedModel}/>

        <Checkbox bind:checked={hideSecrets} title="Hide Secrets">Hide Secret</Checkbox>

        <Button onclick={deployKubernetes} disabled={!selectedModel}>Dryrun</Button>
      </div>

      {#if kubernetes}
        <MonacoEditor content={kubernetes} language="yaml" readOnly={true} />
      {/if}
    </Route>
    <Route path="/run" breadcrumb="Run ({flowExecutions.length})" navigationHint="tab">
      <div class="h-full w-full flex flex-col gap-x-2 items-center">
          <Dropdown
        class="text-sm"
        bind:value={currentLogFlowId}
        onChange={onLogSelectedChange}
        options={flowExecutions.map((flowExecution) => ({
          value: flowExecution.taskId,
          label: flowExecution.taskId,
        }))}>
      </Dropdown>
        <TerminalWindow class="h-full w-full" bind:terminal={logsTerminal} convertEol disableStdIn />
      </div>

    </Route>

  {/snippet}
</DetailsPage>

<!-- <ul>
  <li>{providerId} => {provider?.name}</li>
  <li>{connectionName} => {connection?.name}</li>
  <li>{flowId} => {path}</li>
</ul> -->
