<script lang="ts">
import { Button, Checkbox, ErrorMessage } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';

import MonacoEditor from '/@/lib/editor/MonacoEditor.svelte';
import KubernetesIcon from '/@/lib/kube/KubernetesIcon.svelte';
import KubernetesCurrentContextConnectionBadge from '/@/lib/ui/KubernetesCurrentContextConnectionBadge.svelte';
import { kubernetesContextsHealths } from '/@/stores/kubernetes-context-health';
import { kubernetesContexts } from '/@/stores/kubernetes-contexts';
import { kubernetesCurrentContextState } from '/@/stores/kubernetes-contexts-state';
import type { KubeContext } from '/@api/kubernetes-context';
import type { ProviderFlowConnectionInfo, ProviderInfo } from '/@api/provider-info';

import FlowDetailsKubernetesJobs from './FlowDetailsKubernetesJobs.svelte';
import FlowDetailsKubernetesPods from './FlowDetailsKubernetesPods.svelte';

interface Props {
  flowId: string;
  provider: ProviderInfo;
  connection: ProviderFlowConnectionInfo;
}

const { flowId, provider, connection }: Props = $props();

let error: string | undefined = $state(undefined);
let kubernetes: string | undefined = $state(undefined);

let hideSecretsKubernetesYAML = $state(true);

const currentContext: KubeContext | undefined = $derived($kubernetesContexts?.find(c => c.currentContext));

let selectedTab = $state<'Yaml' | 'Jobs' | 'Pods'>('Yaml');

const clusterReachable: boolean = $derived(
  $kubernetesContextsHealths.find(({ contextName }) => contextName === currentContext?.name)?.reachable ??
    $kubernetesCurrentContextState?.reachable,
);

async function applyKubernetes(): Promise<void> {
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
    selectedTab = 'Jobs';
  } catch (err: unknown) {
    error = String(err);
  }
}

async function refreshKubernetes(checked: boolean): Promise<void> {
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
onMount(async () => {
  await refreshKubernetes(true);
});
</script>

<Button type="tab" on:click={(): string => (selectedTab = 'Yaml')} selected={selectedTab === 'Yaml'}>Yaml</Button>
<Button type="tab" on:click={(): string => (selectedTab = 'Jobs')} selected={selectedTab === 'Jobs'}
  >Flow-Scoped Jobs</Button>
<Button type="tab" on:click={(): string => (selectedTab = 'Pods')} selected={selectedTab === 'Pods'}
  >Flow-Scoped Pods</Button>

{#if error}
  <ErrorMessage {error} />
{/if}
{#if selectedTab === 'Yaml'}
  <div class="flex flex-row px-4 items-center justify-between">
    <Checkbox bind:checked={hideSecretsKubernetesYAML} onclick={refreshKubernetes} title="Hide Secrets"
      >Hide Secret</Checkbox>
    <div class="flex flex-row gap-x-2">
      <KubernetesCurrentContextConnectionBadge />
      <Button disabled={!clusterReachable} icon={KubernetesIcon} onclick={applyKubernetes}>Apply</Button>
    </div>
  </div>
  {#if kubernetes}
    <MonacoEditor content={kubernetes} language="yaml" readOnly={true} />
  {/if}
{:else if selectedTab === 'Jobs'}
  <div class="flex w-full h-full overflow-auto" role="region" aria-label="content">
    <FlowDetailsKubernetesJobs {flowId} />
  </div>
{:else if selectedTab === 'Pods'}
  <div class="flex w-full h-full overflow-auto" role="region" aria-label="content">
    <FlowDetailsKubernetesPods {flowId} />
  </div>
{/if}
