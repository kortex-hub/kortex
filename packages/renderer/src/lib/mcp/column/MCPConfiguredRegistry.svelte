<script lang="ts">
import Label from '/@/lib/ui/Label.svelte';
import type { MCPConfigInfo } from '/@api/mcp/mcp-config-info';

interface Props {
  object: MCPConfigInfo;
}

let { object }: Props = $props();
</script>

<Label tip={object.registryURL} name={object.registryURL}></Label>
