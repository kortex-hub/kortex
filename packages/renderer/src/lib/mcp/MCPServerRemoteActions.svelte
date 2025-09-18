<script lang="ts">
import { faAddressBook } from '@fortawesome/free-solid-svg-icons';

import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';

import ListItemButtonIcon from '../ui/ListItemButtonIcon.svelte';

export let object: MCPRemoteServerInfo;
</script>


 <ListItemButtonIcon
    title="Browse tools from this MCP server"
    icon={faAddressBook}
    />

