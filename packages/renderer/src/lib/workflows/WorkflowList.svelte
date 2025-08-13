<script lang="ts">
import {
  Button,
  NavPage,
  Table,
  TableColumn,
  TableRow,
} from '@podman-desktop/ui-svelte';

import WorkflowName from '/@/lib/workflows/columns/WorkflowName.svelte';
import { workflowsInfos } from '/@/stores/workflows';
import type {WorkflowInfo} from '/@api/workflow-info';

type WorkflowSelectable = WorkflowInfo & { selected: boolean };

const row = new TableRow<WorkflowSelectable>({
  selectable: (_container): boolean => false,
});

let pathColumn = new TableColumn<WorkflowSelectable>('Path', {
  width: '2fr',
  renderer: WorkflowName,
});

const columns = [pathColumn];

function key(workflow: WorkflowSelectable): string {
  return workflow.path;
}
</script>

<NavPage searchEnabled={false} title="workflows">
  {#snippet additionalActions()}
    <Button onclick={window.refreshWorkflows}>
      Refresh
    </Button>
  {/snippet}
  {#snippet content()}
    <Table
      kind="workflows"
      data={$workflowsInfos.map((workflow) => ({ ...workflow, selected: false, name: workflow.path }))}
      columns={columns}
      row={row}
      defaultSortColumn="Path"
      key={key}>
    </Table>
  {/snippet}
</NavPage>
