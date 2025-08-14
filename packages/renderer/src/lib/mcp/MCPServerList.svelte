<script lang="ts">
import { Button, NavPage, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import { mcpRegistriesServerInfos } from '/@/stores/mcp-registry-servers';
import McpIcon from '../images/MCPIcon.svelte';
import type { MCPRegistryServerDetail } from '/@api/mcp/mcp-registry-server-entry';
import McpServerListActions from './MCPServerRegistryListActions.svelte';
import SimpleColumn from '@podman-desktop/ui-svelte/TableSimpleColumn';
import MCPEmptyScreen from './MCPRegistryEmptyScreen.svelte';
import McpServerListRegistryInstall from './MCPServerListRegistryInstall.svelte';
import McpServerListRemoteReady from './MCPServerListRemoteReady.svelte';

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

let selectedTab = $state<'READY' | 'INSTALLABLE'>('READY');
</script>

<NavPage searchEnabled={false} title="MCP servers">

    {#snippet tabs()}
    <Button type="tab" on:click={() => selectedTab = 'READY'} selected={selectedTab === 'READY'}
      >Ready</Button>
    <Button type="tab" on:click={() => selectedTab = 'INSTALLABLE'} selected={selectedTab === 'INSTALLABLE'}
      >Install</Button>
  {/snippet}

  {#snippet content()}
  <div class="flex min-w-full h-full">
      {#if selectedTab === 'READY'}
        <McpServerListRemoteReady />
      {:else if selectedTab === 'INSTALLABLE'}
        <McpServerListRegistryInstall />
        {/if}


    </div>

  {/snippet}
</NavPage>
