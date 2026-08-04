<script lang="ts">
import WarningMessage from '/@/lib/ui/WarningMessage.svelte';
import { openshellGateways, openshellGatewaysReady } from '/@/stores/openshell-gateways';
</script>

{#if $openshellGatewaysReady && $openshellGateways.every(gateway => gateway.gatewayState?.reachable !== true)}
  <WarningMessage
    class="shrink-0 px-3 py-2 bg-(--pd-content-card-bg)"
    error="No usable OpenShell gateways available." />
{/if}
