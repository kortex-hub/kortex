<script lang="ts">
import { faBackward, faForward } from '@fortawesome/free-solid-svg-icons';
import { FilteredEmptyScreen, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import SimpleColumn from '@podman-desktop/ui-svelte/TableSimpleColumn';
import Fa from 'svelte-fa';

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
    <div class="flex items-center justify-center gap-4 py-2">
      <button
        class="px-3 py-1 rounded hover:bg-[var(--pd-button-hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={previousPage}
        disabled={currentPage === 0}
        aria-label="Previous page">
        <Fa icon={faBackward} />
      </button>
      <span class="text-sm">
        Page {currentPage + 1} of {totalPages}
      </span>
      <button
        class="px-3 py-1 rounded hover:bg-[var(--pd-button-hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={nextPage}
        disabled={currentPage >= totalPages - 1}
        aria-label="Next page">
        <Fa icon={faForward} />
      </button>
    </div>
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
    <div class="flex items-center justify-center gap-4 py-2">
      <button
        class="px-3 py-1 rounded hover:bg-[var(--pd-button-hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={previousPage}
        disabled={currentPage === 0}
        aria-label="Previous page">
        <Fa icon={faBackward} />
      </button>
      <span class="text-sm">
        Page {currentPage + 1} of {totalPages}
      </span>
      <button
        class="px-3 py-1 rounded hover:bg-[var(--pd-button-hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={nextPage}
        disabled={currentPage >= totalPages - 1}
        aria-label="Next page">
        <Fa icon={faForward} />
      </button>
    </div>
    {/if}
  </div>
{/if}
