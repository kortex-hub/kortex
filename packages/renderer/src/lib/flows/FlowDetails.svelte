<script lang="ts">
import { Button, Checkbox,Tab } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';

import type { ModelInfo } from '/@/lib/chat/components/model-info';
import ModelSelector from '/@/lib/chat/components/model-selector.svelte';
import MonacoEditor from '/@/lib/editor/MonacoEditor.svelte';
import DetailsPage from '/@/lib/ui/DetailsPage.svelte';
import { getTabUrl, isTabSelected } from '/@/lib/ui/Util';
import Route from '/@/Route.svelte';
import { providerInfos } from '/@/stores/providers';
import type { ProviderFlowConnectionInfo } from '/@api/provider-info';

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
      flowId: path,
      providerId: provider.id,
      connectionName: connection.name,
    },
    {
      hideSecrets: hideSecrets,
      namespace: 'default',
    }
  );
  kubernetes = result;
}
</script>

<DetailsPage title={path}>
  {#snippet tabsSnippet()}
    <Tab title="Summary" selected={isTabSelected($router.path, 'summary')} url={getTabUrl($router.path, 'summary')} />
    {#if connection?.deploy?.kubernetes}
      <Tab title="Kube" selected={isTabSelected($router.path, 'kube')} url={getTabUrl($router.path, 'kube')} />
    {/if}
  {/snippet}
  {#snippet contentSnippet()}
    <Route path="/summary" breadcrumb="Summary" navigationHint="tab">
      <ul>
        <li>{providerId} => {provider?.name}</li>
        <li>{connectionName} => {connection?.name}</li>
        <li>{flowId} => {path}</li>
      </ul>
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
  {/snippet}
</DetailsPage>

<!-- <ul>
  <li>{providerId} => {provider?.name}</li>
  <li>{connectionName} => {connection?.name}</li>
  <li>{flowId} => {path}</li>
</ul> -->
