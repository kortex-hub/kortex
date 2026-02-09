<script lang="ts">
import { FilteredEmptyScreen, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import SimpleColumn from '@podman-desktop/ui-svelte/TableSimpleColumn';

import MCPValidServerIndicatorIcon from '/@/lib/images/MCPValidServerIndicatorIcon.svelte';
import PreviousNext from '/@/lib/ui/PreviousNext.svelte';
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

// Pagination
const PAGE_SIZE = 25;
let currentPage = $state(0);

const totalPages = $derived(Math.ceil(servers.length / PAGE_SIZE));
const paginatedServers = $derived(servers.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE));

// Reset to first page when servers change
$effect(() => {
  servers;
  if (currentPage >= totalPages) {
    currentPage = Math.max(0, totalPages - 1);
  }
});

function previousPage(): void {
  if (currentPage > 0) {
    currentPage--;
  }
}

function nextPage(): void {
  if (currentPage < totalPages - 1) {
    currentPage++;
  }
}

const statusColumn = new TableColumn<MCPServerDetail>('Status', {
  width: '60px',
  overflow: true,
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
  <div class="flex flex-col h-full w-full">
    {#if totalPages > 1}
      <PreviousNext onPrevious={previousPage} onNext={nextPage} previousDisabled={currentPage === 0} nextDisabled={currentPage >= totalPages - 1} title="Page {currentPage + 1} of {totalPages}"></PreviousNext>
    {/if}

    <Table
      kind="mcpServer"
      bind:this={table}
      data={paginatedServers}
      columns={columns}
      row={row}
      defaultSortColumn="Name">
    </Table>

    {#if totalPages > 1}
      <PreviousNext onPrevious={previousPage} onNext={nextPage} previousDisabled={currentPage === 0} nextDisabled={currentPage >= totalPages - 1} title="Page {currentPage + 1} of {totalPages}"></PreviousNext>
    {/if}
  </div>
{/if}
