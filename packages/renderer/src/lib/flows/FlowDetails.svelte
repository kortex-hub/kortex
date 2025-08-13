<script lang="ts">
import { providerInfos } from '/@/stores/providers';

interface Props {
  providerId: string;
  connectionName: string;
  flowId: string;
}

let { providerId, connectionName, flowId }: Props = $props();

let provider = $derived($providerInfos.find(provider => provider.id === providerId));
let connection = $derived(provider?.flowConnections.find(connection => connection.name === connectionName));
let path = $derived(atob(flowId));
</script>

<ul>
  <li>{providerId} => {provider?.name}</li>
  <li>{connectionName} => {connection?.name}</li>
  <li>{flowId} => {path}</li>
</ul>
