<script lang="ts">
import { Dropdown } from '@podman-desktop/ui-svelte';
import type { Terminal } from '@xterm/xterm';
import { onDestroy } from 'svelte';
import type { Unsubscriber } from 'svelte/store';

import { flowCurrentLogInfo } from '/@/stores/flow-current-log';
import type { FlowExecuteInfo } from '/@api/flow-execute-info';

import TerminalWindow from '../ui/TerminalWindow.svelte';

let logsTerminal: Terminal | undefined;

interface Props {
  readonly providerId: string;
  readonly connectionName: string;
  readonly flowId: string;
  readonly flowExecutions: FlowExecuteInfo[];
  readonly selectedFlowExecuteId: string | undefined;
}

let { providerId, connectionName, flowId, flowExecutions, selectedFlowExecuteId }: Props = $props();

// keep track of the current flow execute id
let currentFlowExecuteId: string | undefined = $state(undefined);

$effect(() => {
  if (selectedFlowExecuteId && currentFlowExecuteId !== selectedFlowExecuteId) {
    currentFlowExecuteId = selectedFlowExecuteId;

    onLogSelectedChange(selectedFlowExecuteId).catch(console.error);
  }
});

let flowExecuteUnsubscriber: Unsubscriber | undefined;
let flowCurrentLogUnsubscriber: Unsubscriber | undefined;

function onTerminalInit(): void {
  flowCurrentLogUnsubscriber = flowCurrentLogInfo.subscribe(log => {
    logsTerminal?.clear();
    logsTerminal?.write(log);
  });
}

onDestroy(() => {
  flowExecuteUnsubscriber?.();
  flowCurrentLogUnsubscriber?.();
  logsTerminal?.clear();
  logsTerminal = undefined;
});

async function onLogSelectedChange(taskId: string): Promise<void> {
  logsTerminal?.clear();
  await window.flowDispatchLog(providerId, connectionName, flowId, taskId);
}
</script>

<div class="h-full w-full flex flex-col gap-x-2 items-center">
  <div class="flex flex-row">
    <Dropdown
      class="text-sm"
      disabled={flowExecutions.length === 0}
      value={selectedFlowExecuteId}
      onChange={onLogSelectedChange}
      options={flowExecutions.map(flowExecution => ({
      value: flowExecution.taskId,
      label: flowExecution.taskId,
    }))}>
    </Dropdown>
  </div>
  <TerminalWindow on:init={onTerminalInit} class="h-full w-full" bind:terminal={logsTerminal} convertEol disableStdIn />
</div>
