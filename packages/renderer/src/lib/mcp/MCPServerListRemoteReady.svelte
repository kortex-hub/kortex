<script lang="ts">
import { FilteredEmptyScreen, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';

import MCPValidServerIndicatorIcon from '/@/lib/images/MCPValidServerIndicatorIcon.svelte';
import MCPNameColumn from '/@/lib/mcp/column/MCPNameColumn.svelte';
import { filteredMcpRemoteServerInfos, mcpRemoteServerInfoSearchPattern } from '/@/stores/mcp-remote-servers';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';

import McpIcon from '../images/MCPIcon.svelte';
import { MCPServerDescriptionColumn } from './mcp-server-columns';
import MCPServerEmptyScreen from './MCPServerEmptyScreen.svelte';
import McpServerRemoteListActions from './MCPServerRemoteListActions.svelte';

interface Props {
  filter?: string;
}

let { filter = $bindable() }: Props = $props();

interface SelectableMCPRemoteServerInfo extends MCPRemoteServerInfo {
  selected?: boolean;
}

$effect(() => {
  mcpRemoteServerInfoSearchPattern.set(filter ?? '');
});

const servers: SelectableMCPRemoteServerInfo[] = $derived(
  $filteredMcpRemoteServerInfos.map(server => ({
    ...server,
    selected: false,
  })),
);

const statusColumn = new TableColumn<MCPRemoteServerInfo>('Status', {
  width: '60px',
  renderer: MCPValidServerIndicatorIcon,
});

const nameColumn = new TableColumn<MCPRemoteServerInfo>('Name', {
  width: '2fr',
  renderer: MCPNameColumn,
  comparator: (a, b): number => b.name.localeCompare(a.name),
});

const actionsColumn = new TableColumn<MCPRemoteServerInfo>('Actions', {
  align: 'right',
  renderer: McpServerRemoteListActions,
  overflow: true,
});

const columns = [statusColumn, nameColumn, new MCPServerDescriptionColumn(), actionsColumn];

const row = new TableRow<MCPRemoteServerInfo>({});
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
