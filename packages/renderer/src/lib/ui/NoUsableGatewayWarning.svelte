<script lang="ts">
import WarningMessage from '/@/lib/ui/WarningMessage.svelte';
import { openshellGateways, openshellGatewaysReady } from '/@/stores/openshell-gateways';
import type { GatewayInfo } from '/@api/openshell-gateway-info';

function noUsableGateways(gateways: GatewayInfo[]): boolean {
  return !gateways.some(gateway => gateway.gatewayState?.reachable === true);
}
</script>

{#if $openshellGatewaysReady && noUsableGateways($openshellGateways)}
  <WarningMessage
    class="shrink-0 px-3 py-2 bg-(--pd-content-card-bg)"
    error="No usable OpenShell gateways available." />
{/if}
