<script lang="ts">
import { Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import SimpleColumn from '@podman-desktop/ui-svelte/TableSimpleColumn';
import type { components } from 'mcp-registry';

import { mcpRegistriesServerInfos } from '/@/stores/mcp-registry-servers';

import McpIcon from '../images/MCPIcon.svelte';
import McpEmptyScreen from './MCPRegistryEmptyScreen.svelte';
import McpServerListActions from './MCPServerRegistryListActions.svelte';

type SelectableMCPRegistryServerDetailUI = components['schemas']['ServerDetail'] & {
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
  new TableColumn<components['schemas']['ServerDetail']>('Actions', {
    align: 'right',
    renderer: McpServerListActions,
    overflow: true,
  }),
];

const row = new TableRow<components['schemas']['ServerDetail']>({});
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
