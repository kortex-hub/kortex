<script lang="ts">
import { Button, Table, TableColumn, TableRow, TableSimpleColumn } from '@podman-desktop/ui-svelte';
import { toString } from 'cronstrue';

import FlowDetailsScheduleActions from '/@/lib/flows/FlowDetailsScheduleActions.svelte';
import ScheduleIcon from '/@/lib/images/ScheduleIcon.svelte';
import type { FlowScheduleInfo } from '/@api/flow-schedule-info';

import FlowDetailsScheduleCreateDialog from './FlowDetailsScheduleCreateDialog.svelte';

interface Props {
  readonly flowId: string;
  readonly providerId: string;
  readonly connectionName: string;

  readonly flowSchedules: FlowScheduleInfo[];
}

let { flowId, providerId, connectionName, flowSchedules }: Props = $props();

let showCreateDialog = $state<boolean>(false);

type ScheduleSelectable = FlowScheduleInfo & { selected: boolean };

const row = new TableRow<ScheduleSelectable>({
  selectable: (_): boolean => false,
});

const itemColumn = new TableColumn<ScheduleSelectable>('', {
  width: '40px',
  renderer: ScheduleIcon,
});

let idColumn = new TableColumn<ScheduleSelectable, string>('id', {
  width: '1fr',
  renderMapping: (object): string => object.id.substring(0, 8),
  renderer: TableSimpleColumn,
});

let cronExpressionColumn = new TableColumn<ScheduleSelectable, string>('Cron', {
  width: '2fr',
  renderMapping: (object): string => object.cronExpression,
  renderer: TableSimpleColumn,
});

let cronHumanExpressionColumn = new TableColumn<ScheduleSelectable, string>('Human expression', {
  width: '2fr',
  renderMapping: (object): string => toString(object.cronExpression, { verbose: true, use24HourTimeFormat: true }),
  renderer: TableSimpleColumn,
});

const scheduleActions = new TableColumn<ScheduleSelectable>('Actions', {
  align: 'right',
  renderer: FlowDetailsScheduleActions,
  overflow: true,
});

const columns = [itemColumn, idColumn, cronExpressionColumn, cronHumanExpressionColumn, scheduleActions];

function key(flow: ScheduleSelectable): string {
  return flow.id;
}
</script>

<div class="w-full flex flex-col">
  <div class="w-full flex flex-row justify-end p-2">
    <Button
      type="primary"
      onclick={(): void => {
        showCreateDialog = true;
      }}>Create Schedule</Button>
  </div>
  <div class="flex min-w-full h-full">
    <Table
      kind="flows"
      data={flowSchedules.map(flow => ({ ...flow, selected: false, name: flow.id }))}
      {columns}
      {row}
      defaultSortColumn="Path"
      {key} />
  </div>
</div>

{#if showCreateDialog}
  <FlowDetailsScheduleCreateDialog
    {flowId}
    {providerId}
    {connectionName}
    closeCallback={():void => {
      showCreateDialog = false;
    }} />
{/if}
