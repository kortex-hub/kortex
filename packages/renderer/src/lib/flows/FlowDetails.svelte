<script lang="ts">
import { Spinner, Tab } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';
import { router } from 'tinro';

import DetailsCell from '/@/lib/details/DetailsCell.svelte';
import DetailsTable from '/@/lib/details/DetailsTable.svelte';
import DetailsTitle from '/@/lib/details/DetailsTitle.svelte';
import MonacoEditor from '/@/lib/editor/MonacoEditor.svelte';
import DetailsPage from '/@/lib/ui/DetailsPage.svelte';
import { getTabUrl, isTabSelected } from '/@/lib/ui/Util';
import Route from '/@/Route.svelte';
import { flowsInfos } from '/@/stores/flows';
import { executeFlowsInfo } from '/@/stores/flows-execute';
import { providerInfos } from '/@/stores/providers';
import type { FlowInfo } from '/@api/flow-info';
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

let flowInfo: FlowInfo | undefined = $derived($flowsInfos.find(({ id }) => id === flowId));

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

<DetailsPage title={flowInfo?.path ?? ''}>
  {#snippet tabsSnippet()}
    <Tab title="Summary" selected={isTabSelected($router.path, 'summary')} url={getTabUrl($router.path, 'summary')} />
    <Tab title="Source" selected={isTabSelected($router.path, 'source')} url={getTabUrl($router.path, 'source')} />
    <Tab title="Kubernetes" selected={isTabSelected($router.path, 'kubernetes')} url={getTabUrl($router.path, 'kubernetes')} />
    {#if flowExecutions.length > 0 || isTabSelected($router.path, 'run') }
      <Tab title="Run ({flowExecutions.length})" selected={isTabSelected($router.path, 'run')} url={getTabUrl($router.path, 'run')} />
    {/if}

  {/snippet}
    {#snippet actionsSnippet()}
      {#if flowInfo}
        <FlowActions
          object={flowInfo}
          onLocalRun={setSelectedFlowExecuteId} />
      {/if}
    {/snippet}
  {#snippet contentSnippet()}
    <Route path="/summary" breadcrumb="Summary" navigationHint="tab">
      {#if loading}
        <div>
          <Spinner/>
        </div>
      {:else if flowInfo}
        <div class="h-min">
          <DetailsTable>
            <tr>
              <DetailsTitle>Details</DetailsTitle>
            </tr>
            <tr>
              <DetailsCell>Provider</DetailsCell>
              <DetailsCell>{provider?.name}</DetailsCell>
            </tr>
            <tr>
              <DetailsCell>Connection</DetailsCell>
              <DetailsCell>{connection?.name}</DetailsCell>
            </tr>
            <tr>
              <DetailsCell>Path</DetailsCell>
              <DetailsCell>{flowInfo.path}</DetailsCell>
            </tr>
          </DetailsTable>
        </div>

        {#if (flowInfo.parameters ?? []).length > 0}
          <div class="h-min">
            <DetailsTable>
              <tr>
                <DetailsTitle>Flow Parameters</DetailsTitle>
              </tr>
              <tr>
                <DetailsCell>
                  <tr>
                    <DetailsCell>
                      <strong>Name</strong>
                    </DetailsCell>
                    <DetailsCell>
                      <strong>Description</strong>
                    </DetailsCell>
                    <DetailsCell>
                      <strong>Required</strong>
                    </DetailsCell>
                    <DetailsCell>
                      <strong>Default</strong>
                    </DetailsCell>
                  </tr>
                  {#each (flowInfo.parameters ?? []) as param (param.name)}
                    <tr>
                      <DetailsCell>
                        {param.name}
                      </DetailsCell>
                      <DetailsCell>
                        {param.description}
                      </DetailsCell>
                      <DetailsCell>
                        {param.required}
                      </DetailsCell>
                      <DetailsCell>
                        {param.default}
                      </DetailsCell>
                    </tr>
                  {/each}
                </DetailsCell>
              </tr>
            </DetailsTable>
          </div>
        {/if}
      {/if}
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
  {/snippet}
</DetailsPage>

<!-- <ul>
  <li>{providerId} => {provider?.name}</li>
  <li>{connectionName} => {connection?.name}</li>
  <li>{flowId} => {path}</li>
</ul> -->
