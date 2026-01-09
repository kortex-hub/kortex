<script lang="ts">
import { FilteredEmptyScreen, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import SimpleColumn from '@podman-desktop/ui-svelte/TableSimpleColumn';

import MCPValidServerIndicatorIcon from '/@/lib/images/MCPValidServerIndicatorIcon.svelte';
import {
  filteredMcpRegistriesServerInfos,
  mcpRegistriesServerInfosSearchPattern,
} from '/@/stores/mcp-registry-servers';
import type { MCPServerDetail } from '/@api/mcp/mcp-server-info';

import McpIcon from '../images/MCPIcon.svelte';
import { MCPServerDescriptionColumn } from './mcp-server-columns';
import McpEmptyScreen from './MCPRegistryEmptyScreen.svelte';
import McpServerListActions from './MCPServerRegistryListActions.svelte';

interface Props {
  filter?: string;
}

let { filter = $bindable() }: Props = $props();

type SelectableMCPRegistryServerDetailUI = MCPServerDetail & {
  selected?: boolean;
};

$effect(() => {
  mcpRegistriesServerInfosSearchPattern.set(filter ?? '');
});

const servers: SelectableMCPRegistryServerDetailUI[] = $derived(
  $filteredMcpRegistriesServerInfos
    .map(
      (server): SelectableMCPRegistryServerDetailUI => ({
        ...server,
        selected: false,
      }),
    )
    .filter(server => server.name.toLowerCase().includes(filter?.toLowerCase() ?? '')),
);

let table: Table<SelectableMCPRegistryServerDetailUI>;

const statusColumn = new TableColumn<MCPServerDetail>('Status', {
  width: '60px',
  renderer: MCPValidServerIndicatorIcon,
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
        {#if filter}
        <FilteredEmptyScreen icon={McpIcon} kind="MCP Servers" bind:searchTerm={filter}/>
        {:else}
        <McpEmptyScreen />
        {/if}
      {:else}

    <Table
      kind="mcpServer"
      bind:this={table}
      data={servers}
      columns={columns}
      row={row}
      defaultSortColumn="Name">
    </Table>
    {/if}
