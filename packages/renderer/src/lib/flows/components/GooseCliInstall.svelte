<script lang="ts">
import { gooseCliTool } from '/@/stores/flow-providers';

import PreferencesCliTool from '../../preferences/PreferencesCliTool.svelte';
</script>

{#if $gooseCliTool}
  <PreferencesCliTool cliTool={$gooseCliTool} />
{/if}
