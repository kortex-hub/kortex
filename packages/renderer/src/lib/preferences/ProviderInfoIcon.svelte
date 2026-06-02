<script lang="ts">
import type { ProviderInfo } from '/@api/provider-info';

import ThemedIcon from './ThemedIcon.svelte';

let { providerInfo }: { providerInfo: ProviderInfo } = $props();
</script>

<ThemedIcon icon={providerInfo?.images?.icon} alt={providerInfo?.name ?? ''} class="max-h-10" />
