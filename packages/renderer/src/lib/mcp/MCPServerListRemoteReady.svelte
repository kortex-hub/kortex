<script lang="ts">
import { Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import { mcpRegistriesServerInfos } from '/@/stores/mcp-registry-servers';
import McpIcon from '../images/MCPIcon.svelte';
import type { MCPRegistryServerDetail } from '/@api/mcp/mcp-registry-server-entry';
import McpServerListActions from './MCPServerRegistryListActions.svelte';
import SimpleColumn from '@podman-desktop/ui-svelte/TableSimpleColumn';
import MCPServerEmptyScreen from './MCPServerEmptyScreen.svelte';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';
import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';
import McpServerRemoteActions from './MCPServerRemoteActions.svelte';

interface SelectableMCPRemoteServerInfo extends MCPRemoteServerInfo {
  selected?: boolean;
}

const servers: SelectableMCPRemoteServerInfo[] = $derived(
  $mcpRemoteServerInfos.map(server => ({
    ...server,
    selected: false,
  })),
);

let table: Table<SelectableMCPRemoteServerInfo>;

const statusColumn = new TableColumn<MCPRemoteServerInfo>('Status', {
  width: '60px',
  renderer: McpIcon,
});

const nameColumn = new TableColumn<MCPRemoteServerInfo, string>('Name', {
  width: '2fr',
  renderMapping: obj => obj.name,
  renderer: SimpleColumn,
  comparator: (a, b): number => b.name.localeCompare(a.name),
});

const columns = [
  statusColumn,
  nameColumn,
  new TableColumn<MCPRemoteServerInfo>('Actions', { align: 'right', renderer: McpServerRemoteActions, overflow: true }),
];

const row = new TableRow<MCPRemoteServerInfo>({});
</script>

      {#if servers.length === 0}
        <MCPServerEmptyScreen />
      {:else}

    <Table
      kind="volume"
      bind:this={table}
      data={servers}
      columns={columns}
      row={row}
      defaultSortColumn="Name">
    </Table>
    {/if}
