<script lang="ts">
import { Dropdown } from '@podman-desktop/ui-svelte';
import type { Terminal } from '@xterm/xterm';
import { onDestroy } from 'svelte';
import type { Unsubscriber } from 'svelte/store';

import { flowCurrentLogInfo } from '/@/stores/flow-current-log';
import type { FlowExecuteInfo } from '/@api/flow-execute-info';

import TerminalWindow from '../ui/TerminalWindow.svelte';

let dropDownFlowId = $state('');
let logsTerminal: Terminal | undefined;

interface Props {
  providerId: string;
  connectionName: string;
  flowId: string;
  flowExecutions: FlowExecuteInfo[];
}

let { providerId, connectionName, flowId, flowExecutions }: Props = $props();

let latest = $derived(flowExecutions.length > 0 ? flowExecutions[flowExecutions.length - 1] : undefined);

$effect(() => {
  if (latest && !dropDownFlowId) {
    dropDownFlowId = latest.taskId;
    onLogSelectedChange(dropDownFlowId).catch(console.error);
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
  if (taskId === dropDownFlowId) {
    return; // do not change when selecting current
  }

  dropDownFlowId = taskId;
  logsTerminal?.clear();
  await window.flowDispatchLog(providerId, connectionName, flowId, taskId);
}
</script>

<div class="h-full w-full flex flex-col gap-x-2 items-center">
  <Dropdown
    class="text-sm"
    value={dropDownFlowId}
    onChange={onLogSelectedChange}
    options={flowExecutions.map(flowExecution => ({
      value: flowExecution.taskId,
      label: flowExecution.taskId,
    }))}>
  </Dropdown>
  <TerminalWindow on:init={onTerminalInit} class="h-full w-full" bind:terminal={logsTerminal} convertEol disableStdIn />
</div>
