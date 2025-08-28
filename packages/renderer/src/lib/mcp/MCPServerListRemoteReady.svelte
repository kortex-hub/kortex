<script lang="ts">
import { Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';

import MCPNameColumn from '/@/lib/mcp/column/MCPNameColumn.svelte';
import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';

import McpIcon from '../images/MCPIcon.svelte';
import MCPServerEmptyScreen from './MCPServerEmptyScreen.svelte';

interface SelectableMCPRemoteServerInfo extends MCPRemoteServerInfo {
  selected?: boolean;
}

const servers: SelectableMCPRemoteServerInfo[] = $derived(
  $mcpRemoteServerInfos.map(server => ({
    ...server,
    selected: false,
  })),
);

const statusColumn = new TableColumn<MCPRemoteServerInfo>('Status', {
  width: '60px',
  renderer: McpIcon,
});

const nameColumn = new TableColumn<MCPRemoteServerInfo>('Name', {
  width: '2fr',
  renderer: MCPNameColumn,
  comparator: (a, b): number => b.name.localeCompare(a.name),
});

const columns = [statusColumn, nameColumn];

const row = new TableRow<MCPRemoteServerInfo>({});
</script>

{#if servers.length === 0}
  <MCPServerEmptyScreen />
{:else}

  <Table
    kind="mcp"
    data={servers}
    columns={columns}
    row={row}
    defaultSortColumn="Name">
  </Table>
{/if}
