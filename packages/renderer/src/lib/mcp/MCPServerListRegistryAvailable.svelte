<script lang="ts">
import type { MCPRegistry, MCPRegistrySuggestedProvider } from '@kortex-app/api';
import type { components } from '@kortex-hub/mcp-registry-types';
import { FilteredEmptyScreen, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import SimpleColumn from '@podman-desktop/ui-svelte/TableSimpleColumn';

import MCPRegistryDropdown from '/@/lib/mcp/components/MCPRegistryDropdown.svelte';
import PaginatedTable from '/@/lib/mcp/table/PaginatedTable.svelte';
import { mcpRegistriesInfos, mcpRegistriesSuggestedInfos } from '/@/stores/mcp-registries';
import { MCPRegistryStore } from '/@/stores/pagination/mcp-registry-store';

import McpIcon from '../images/MCPIcon.svelte';
import McpEmptyScreen from './MCPRegistryEmptyScreen.svelte';
import McpServerListActions from './MCPServerRegistryListActions.svelte';

interface Props {
  filter?: string;
  scrollToTop: () => void;
}

let { filter = $bindable(), scrollToTop }: Props = $props();

let selectedMCPRegistry: MCPRegistry | MCPRegistrySuggestedProvider | undefined = $state();

$effect(() => {
  if (selectedMCPRegistry) return;

  if ($mcpRegistriesInfos.length > 0) {
    selectedMCPRegistry = $mcpRegistriesInfos[0];
  } else if ($mcpRegistriesSuggestedInfos.length > 0) {
    selectedMCPRegistry = $mcpRegistriesSuggestedInfos[0];
  }
});

let store: MCPRegistryStore | undefined = $derived(
  selectedMCPRegistry
    ? new MCPRegistryStore('url' in selectedMCPRegistry ? selectedMCPRegistry.url : selectedMCPRegistry.serverUrl)
    : undefined,
);

const statusColumn = new TableColumn<components['schemas']['ServerDetail']>('Status', {
  width: '60px',
  renderer: McpIcon,
});

const nameColumn = new TableColumn<components['schemas']['ServerDetail'], string>('Name', {
  width: '2fr',
  renderMapping: (obj): string => obj.name,
  renderer: SimpleColumn,
  comparator: (a, b): number => b.name.localeCompare(a.name),
});

const columns = [
  statusColumn,
  nameColumn,
  new TableColumn<components['schemas']['ServerDetail'] & { registryURL: string }>('Actions', {
    align: 'right',
    renderer: McpServerListActions,
    renderMapping: (object): components['schemas']['ServerDetail'] & { registryURL: string } => ({
      ...object,
      registryURL: store?.baseURL ?? '<<unknown>>',
    }),
    overflow: true,
  }),
];

const row = new TableRow<components['schemas']['ServerDetail']>({});
</script>

<!-- dropdown -->
<div class="mx-5 flex mt-2">
  <MCPRegistryDropdown items={[
...$mcpRegistriesInfos,
...$mcpRegistriesSuggestedInfos,
]} bind:selected={selectedMCPRegistry} />
</div>

{#if store !== undefined}
  {#key selectedMCPRegistry}
    <PaginatedTable
      kind="mcpServer"
      store={store}
      columns={columns}
      row={row}
      scrollToTop={scrollToTop}
      defaultSortColumn="Name">
    </PaginatedTable>
  {/key}
{:else}
  {#if filter}
    <FilteredEmptyScreen icon={McpIcon} kind="MCP Servers" bind:searchTerm={filter}/>
  {:else}
    <McpEmptyScreen />
  {/if}
{/if}

