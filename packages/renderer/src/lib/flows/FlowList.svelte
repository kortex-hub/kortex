<script lang="ts">
import { Button, NavPage, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';

import FlowName from '/@/lib/flows/columns/FlowName.svelte';
import { flowsInfos } from '/@/stores/flows';
import type { FlowInfo } from '/@api/flow-info';

type FlowSelectable = FlowInfo & { selected: boolean };

const row = new TableRow<FlowSelectable>({
  selectable: (_): boolean => false,
});

let pathColumn = new TableColumn<FlowSelectable>('Path', {
  width: '2fr',
  renderer: FlowName,
});

const columns = [pathColumn];

function key(flow: FlowSelectable): string {
  return flow.path;
}
</script>

<NavPage searchEnabled={false} title="FLows">
  {#snippet additionalActions()}
    <Button onclick={window.refreshFlows}>
      Refresh
    </Button>
  {/snippet}
  {#snippet content()}
    <Table
      kind="flows"
      data={$flowsInfos.map((flow) => ({ ...flow, selected: false, name: flow.path }))}
      columns={columns}
      row={row}
      defaultSortColumn="Path"
      key={key}>
    </Table>
  {/snippet}
</NavPage>
