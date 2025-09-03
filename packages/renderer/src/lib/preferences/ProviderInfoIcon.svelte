<script lang="ts">
import type { ProviderInfo } from '/@api/provider-info';

let { providerInfo }: { providerInfo: ProviderInfo } = $props();
</script>

{#if providerInfo?.images?.icon}
  {#if typeof providerInfo.images.icon === 'string'}
    <img src={providerInfo.images.icon} alt={providerInfo.name} class="max-h-10" />
  {:else}
    <!-- TODO check theme used for image, now use dark by default -->
    <img src={providerInfo.images.icon.dark} alt={providerInfo.name} class="max-h-10" />
  {/if}
{/if}
