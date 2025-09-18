<script lang="ts">
import { Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import SimpleColumn from '@podman-desktop/ui-svelte/TableSimpleColumn';

import { mcpRegistriesServerInfos } from '/@/stores/mcp-registry-servers';
import type { MCPServerDetail } from '/@api/mcp/mcp-server-info';

import McpIcon from '../images/MCPIcon.svelte';
import { MCPServerDescriptionColumn } from './mcp-server-columns';
import McpEmptyScreen from './MCPRegistryEmptyScreen.svelte';
import McpServerListActions from './MCPServerRegistryListActions.svelte';

type SelectableMCPRegistryServerDetailUI = MCPServerDetail & {
  selected?: boolean;
};

const servers: SelectableMCPRegistryServerDetailUI[] = $derived(
  $mcpRegistriesServerInfos.map(
    (server): SelectableMCPRegistryServerDetailUI => ({
      ...server,
      selected: false,
    }),
  ),
);

let table: Table<SelectableMCPRegistryServerDetailUI>;

const statusColumn = new TableColumn<MCPServerDetail>('Status', {
  width: '60px',
  renderer: McpIcon,
});

const nameColumn = new TableColumn<MCPServerDetail, string>('Name', {
  width: '2fr',
  renderMapping: (obj): string => obj.name,
  renderer: SimpleColumn,
  comparator: (a, b): number => b.name.localeCompare(a.name),
});

const columns = [
  statusColumn,
  nameColumn,
  new MCPServerDescriptionColumn(),
  new TableColumn<MCPServerDetail>('Actions', {
    align: 'right',
    renderer: McpServerListActions,
    overflow: true,
  }),
];

const row = new TableRow<MCPServerDetail>({});
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
