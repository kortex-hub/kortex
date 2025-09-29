<script lang="ts">
import { faTrash } from '@fortawesome/free-solid-svg-icons';

import type {MCPConfigInfo} from '/@api/mcp/mcp-config-info';

import ListItemButtonIcon from '../ui/ListItemButtonIcon.svelte';

export let object: MCPConfigInfo;

async function removeMcp(): Promise<void> {
  // TODO
  throw new Error('Not implemented');
  /* const options = object.infos;
  await window.removeMcpRemoteServer(object.id, options); */
}
</script>

<!--
 <ListItemButtonIcon
    title="Remove instance of MCP"
    icon={faTrash}
    onClick={removeMcp}
    /> -->

