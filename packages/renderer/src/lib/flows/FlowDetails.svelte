<script lang="ts">
import { Button, Checkbox, Spinner, Tab } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';
import { router } from 'tinro';

import MonacoEditor from '/@/lib/editor/MonacoEditor.svelte';
import KubernetesIcon from '/@/lib/kube/KubernetesIcon.svelte';
import DetailsPage from '/@/lib/ui/DetailsPage.svelte';
import KubernetesCurrentContextConnectionBadge from '/@/lib/ui/KubernetesCurrentContextConnectionBadge.svelte';
import { getTabUrl, isTabSelected } from '/@/lib/ui/Util';
import Route from '/@/Route.svelte';
import { executeFlowsInfo } from '/@/stores/flows-execute';
import { kubernetesContextsHealths } from '/@/stores/kubernetes-context-health';
import { kubernetesContexts } from '/@/stores/kubernetes-contexts';
import { kubernetesCurrentContextState } from '/@/stores/kubernetes-contexts-state';
import { providerInfos } from '/@/stores/providers';
import type { KubeContext } from '/@api/kubernetes-context';
import type { ProviderFlowConnectionInfo } from '/@api/provider-info';

import FlowActions from './FlowActions.svelte';
import FlowDetailsRun from './FlowDetailsRun.svelte';

interface Props {
  providerId: string;
  connectionName: string;
  flowId: string;
}

let { providerId, connectionName, flowId }: Props = $props();

const currentContext: KubeContext | undefined = $derived($kubernetesContexts?.find(c => c.currentContext));
const clusterReachable: boolean = $derived(
  $kubernetesContextsHealths.find(({ contextName }) => contextName === currentContext?.name)?.reachable ??
    $kubernetesCurrentContextState?.reachable,
);

let hideSecretsKubernetesYAML = $state(true);
let loading: boolean = $state(false);

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

let kubernetes: string | undefined = $state(undefined);

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

async function refreshKubernetes(checked: boolean): Promise<void> {
  if (!provider) return;
  if (!connection) return;

  const result = await window.flowDeployKubernetes(
    {
      flowId: flowId,
      providerId: provider.id,
      connectionName: connection.name,
    },
    {
      hideSecrets: checked,
      namespace: 'default',
      dryrun: true,
    },
  );
  kubernetes = result;
}

async function applyKubernetes(): Promise<void> {
  if (!provider) return;
  if (!connection) return;

  try {
    await window.flowDeployKubernetes(
      {
        flowId: flowId,
        providerId: provider.id,
        connectionName: connection.name,
      },
      {
        hideSecrets: false,
        namespace: 'default',
        dryrun: false,
      },
    );
    router.goto('/jobs');
  } catch (err: unknown) {
    console.error('something went wrong while applying resources', err);
  }
}

onMount(() => {
  loading = true;

  Promise.allSettled([
    window.readFlow(providerId, connectionName, flowId).then(content => {
      flowContent = content;
    }),
    refreshKubernetes(true),
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
        <div class="flex flex-row px-4 items-center justify-between">
          <Checkbox bind:checked={hideSecretsKubernetesYAML} onclick={refreshKubernetes} title="Hide Secrets">Hide Secret</Checkbox>
          <div class="flex flex-row gap-x-2">
            <KubernetesCurrentContextConnectionBadge />
            <Button
              disabled={!clusterReachable}
              icon={KubernetesIcon}
              onclick={applyKubernetes}>
              Apply
            </Button>
          </div>

        </div>
        {#if kubernetes}
          <MonacoEditor content={kubernetes} language="yaml" readOnly={true} />
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
