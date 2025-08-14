<script lang="ts">
import { Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import { mcpRegistriesServerInfos } from '/@/stores/mcp-registry-servers';
import McpIcon from '../images/MCPIcon.svelte';
import type { MCPRegistryServerDetail } from '/@api/mcp/mcp-registry-server-entry';
import McpServerListActions from './MCPServerRegistryListActions.svelte';
import SimpleColumn from '@podman-desktop/ui-svelte/TableSimpleColumn';
import McpEmptyScreen from './MCPRegistryEmptyScreen.svelte';

interface SelectableMCPRegistryServerDetailUI extends MCPRegistryServerDetail {
  selected?: boolean;
}

const servers: SelectableMCPRegistryServerDetailUI[] = $derived(
  $mcpRegistriesServerInfos.map(
    (server): SelectableMCPRegistryServerDetailUI => ({
      ...server,
      selected: false,
    }),
  ),
);

let table: Table<SelectableMCPRegistryServerDetailUI>;

const statusColumn = new TableColumn<MCPRegistryServerDetail>('Status', {
  width: '60px',
  renderer: McpIcon,
});

const nameColumn = new TableColumn<MCPRegistryServerDetail, string>('Name', {
  width: '2fr',
  renderMapping: obj => obj.name,
  renderer: SimpleColumn,
  comparator: (a, b): number => b.name.localeCompare(a.name),
});

const columns = [
  statusColumn,
  nameColumn,
  new TableColumn<MCPRegistryServerDetail>('Actions', {
    align: 'right',
    renderer: McpServerListActions,
    overflow: true,
  }),
];

const row = new TableRow<MCPRegistryServerDetail>({});
</script>

      {#if servers.length === 0}
        <McpEmptyScreen />
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
