<script lang="ts">
import { faTrash } from '@fortawesome/free-solid-svg-icons';

import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';

import ListItemButtonIcon from '../ui/ListItemButtonIcon.svelte';

export let object: MCPRemoteServerInfo;

async function removeMcp(): Promise<void> {
  const options = object.infos;
  await window.removeMcpRemoteServer(object.id, options);
}
</script>

 <ListItemButtonIcon
    title="Remove instance of MCP"
    icon={faTrash}
    onClick={removeMcp}
    />

