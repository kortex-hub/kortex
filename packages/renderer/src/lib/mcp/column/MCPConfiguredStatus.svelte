<script lang="ts">
import { StatusIcon } from '@podman-desktop/ui-svelte';

import McpIcon from '/@/lib/images/MCPIcon.svelte';
import type { MCPConfigInfo } from '/@api/mcp/mcp-config-info';

interface Props {
  object: MCPConfigInfo;
}

let { object }: Props = $props();

let status = $derived(object.status === 'running' ? 'RUNNING' : 'STOPPED');
</script>

<StatusIcon icon={McpIcon} status={status}/>
