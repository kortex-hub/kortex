<script lang="ts">
import { FilteredEmptyScreen, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';

import MCPNameColumn from '/@/lib/mcp/column/MCPNameColumn.svelte';
import { filteredMcpRemoteServerInfos, mcpRemoteServerInfoSearchPattern } from '/@/stores/mcp-remote-servers';
import type {MCPConfigInfo} from '/@api/mcp/mcp-config-info';

import McpIcon from '../images/MCPIcon.svelte';
import MCPServerEmptyScreen from './MCPServerEmptyScreen.svelte';
import McpServerRemoteListActions from './MCPServerRemoteListActions.svelte';

interface Props {
  filter?: string;
}

let { filter = $bindable() }: Props = $props();

interface SelectableMCPConfigInfo extends MCPConfigInfo {
  selected?: boolean;
}

$effect(() => {
  mcpRemoteServerInfoSearchPattern.set(filter ?? '');
});

const servers: SelectableMCPConfigInfo[] = $derived(
  $filteredMcpRemoteServerInfos.map(server => ({
    ...server,
    selected: false,
  })),
);

const statusColumn = new TableColumn<SelectableMCPConfigInfo>('Status', {
  width: '60px',
  renderer: McpIcon,
});

const nameColumn = new TableColumn<MCPConfigInfo>('Name', {
  width: '2fr',
  renderer: MCPNameColumn,
  comparator: (a, b): number => b.name.localeCompare(a.name),
});

const actionsColumn = new TableColumn<MCPConfigInfo>('Actions', {
  align: 'right',
  renderer: McpServerRemoteListActions,
  overflow: true,
});

const columns = [statusColumn, nameColumn, actionsColumn];

const row = new TableRow<MCPConfigInfo>({});
</script>

{#if servers.length === 0}
  {#if filter}
    <FilteredEmptyScreen icon={McpIcon} kind="MCP Servers" bind:searchTerm={filter}/>
  {:else}
    <MCPServerEmptyScreen />
  {/if}
{:else}

  <Table
    kind="mcp"
    data={servers}
    columns={columns}
    row={row}
    defaultSortColumn="Name">
  </Table>
{/if}
