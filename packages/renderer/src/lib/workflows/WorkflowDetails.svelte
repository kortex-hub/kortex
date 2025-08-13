<script lang="ts">
import {providerInfos} from "/@/stores/providers";
import WorkflowTerminal from "/@/lib/workflows/WorkflowTerminal.svelte";

interface Props {
  internalId: string;
  connectionName: string;
  workflowId: string;
}

let { internalId, connectionName, workflowId }: Props = $props();

let provider = $derived($providerInfos.find(provider => provider.internalId === internalId));
let connection = $derived(provider?.workflowConnections.find(connection => connection.name === connectionName));
let path = $derived(atob(workflowId));

</script>

<ul>
  <li>{internalId} => {provider?.name}</li>
  <li>{connectionName} => {connection?.name}</li>
  <li>{workflowId} => {path}</li>
</ul>

{#if !!provider && !!connection && !!path}
  <WorkflowTerminal
    provider={provider}
    connectionInfo={connection}
    workflowId={path}
  />
{/if}
