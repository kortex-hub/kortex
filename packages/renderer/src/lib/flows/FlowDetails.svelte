<script lang="ts">
import { Spinner, Tab } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';
import { router } from 'tinro';

import MonacoEditor from '/@/lib/editor/MonacoEditor.svelte';
import DetailsPage from '/@/lib/ui/DetailsPage.svelte';
import { getTabUrl, isTabSelected } from '/@/lib/ui/Util';
import Route from '/@/Route.svelte';
import { flowsInfos } from '/@/stores/flows';
import { executeFlowsInfo } from '/@/stores/flows-execute';
import { providerInfos } from '/@/stores/providers';
import type { ProviderFlowConnectionInfo } from '/@api/provider-info';

import FlowActions from './FlowActions.svelte';
import FlowDetailsKubernetes from './FlowDetailsKubernetes.svelte';
import FlowDetailsRun from './FlowDetailsRun.svelte';

interface Props {
  providerId: string;
  connectionName: string;
  flowId: string;
}

let { providerId, connectionName, flowId }: Props = $props();

let loading: boolean = $state(false);

let provider = $derived($providerInfos.find(provider => provider.id === providerId));
let connection: ProviderFlowConnectionInfo | undefined = $derived(
  provider?.flowConnections.find(connection => connection.name === connectionName),
);
let { path, name } = $derived.by(() => {
  const matchingFlow = $flowsInfos.find(
    flowInfo =>
      flowInfo.id === flowId && flowInfo.providerId === providerId && flowInfo.connectionName === connectionName,
  );
  if (!matchingFlow) {
    return { path: atob(flowId), name: atob(flowId) };
  }
  return matchingFlow;
});

let flowInfo = $derived({
  providerId,
  id: flowId,
  path,
  name,
  connectionName,
});

let flowContent: string | undefined = $state(undefined);

let selectedFlowExecuteId: string | undefined = $state(undefined);

const flowExecutions = $derived(
  $executeFlowsInfo.filter(
    flow =>
      flow.flowInfo.connectionName === connectionName &&
      flow.flowInfo.providerId === providerId &&
      flow.flowInfo.id === flowId,
  ),
);

$effect(() => {
  if (!selectedFlowExecuteId && flowExecutions.length > 0) {
    selectedFlowExecuteId = flowExecutions[flowExecutions.length - 1].taskId;
  }
});

onMount(() => {
  loading = true;

  Promise.allSettled([
    window.readFlow(providerId, connectionName, flowId).then(content => {
      flowContent = content;
    }),
  ])
    .catch(console.error)
    .finally(() => {
      loading = false;
    });
});

function setSelectedFlowExecuteId(flowExecuteId: string): void {
  selectedFlowExecuteId = flowExecuteId;
}
</script>

<DetailsPage  title={path}>
  {#snippet tabsSnippet()}
    <Tab title="Summary" selected={isTabSelected($router.path, 'summary')} url={getTabUrl($router.path, 'summary')} />
    <Tab title="Source" selected={isTabSelected($router.path, 'source')} url={getTabUrl($router.path, 'source')} />
    <Tab title="Kubernetes" selected={isTabSelected($router.path, 'kubernetes')} url={getTabUrl($router.path, 'kubernetes')} />
    {#if flowExecutions.length > 0 || isTabSelected($router.path, 'run') }
      <Tab title="Run ({flowExecutions.length})" selected={isTabSelected($router.path, 'run')} url={getTabUrl($router.path, 'run')} />
    {/if}

  {/snippet}
    {#snippet actionsSnippet()}
      <FlowActions
        object={flowInfo}
        onLocalRun={setSelectedFlowExecuteId} />
    {/snippet}
  {#snippet contentSnippet()}
    {#if loading}
      <div>
        <Spinner/>
      </div>
    {:else}
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
      <Route path="/kubernetes" breadcrumb="Kube" navigationHint="tab">
        {#if provider && connection}
        <FlowDetailsKubernetes {connection} {flowId} {provider}/>
        {/if}
      </Route>
      <Route path="/run" breadcrumb="Run ({flowExecutions.length})" navigationHint="tab">
        <FlowDetailsRun {providerId} {connectionName} {flowId} {flowExecutions} selectedFlowExecuteId={selectedFlowExecuteId}/>
      </Route>
    {/if}
  {/snippet}
</DetailsPage>

<!-- <ul>
  <li>{providerId} => {provider?.name}</li>
  <li>{connectionName} => {connection?.name}</li>
  <li>{flowId} => {path}</li>
</ul> -->
