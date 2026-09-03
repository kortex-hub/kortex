<script lang="ts">
import { gooseCliTool } from '/@/stores/goose-cli-tool';

import PreferencesCliTool from '../../preferences/PreferencesCliTool.svelte';
</script>

{#if $gooseCliTool}
  <PreferencesCliTool cliTool={$gooseCliTool} />
{/if}
