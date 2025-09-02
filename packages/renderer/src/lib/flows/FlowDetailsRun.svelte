<script lang="ts">
import { Dropdown } from '@podman-desktop/ui-svelte';
import type { Terminal } from '@xterm/xterm';
import { onDestroy, onMount } from 'svelte';
import type { Unsubscriber } from 'svelte/store';

import { flowCurrentLogInfo } from '/@/stores/flow-current-log';
import type { FlowExecuteInfo } from '/@api/flow-execute-info';

import TerminalWindow from '../ui/TerminalWindow.svelte';

let logsTerminal: Terminal | undefined;

interface Props {
  providerId: string;
  connectionName: string;
  flowId: string;
  flowExecutions: FlowExecuteInfo[];
  selectedFlowExecuteId: string | undefined;
}

let { providerId, connectionName, flowId, flowExecutions, selectedFlowExecuteId = $bindable() }: Props = $props();

let latest = $derived(flowExecutions.length > 0 ? flowExecutions[flowExecutions.length - 1] : undefined);

$effect(() => {
  if (latest && !selectedFlowExecuteId) {
    selectedFlowExecuteId = latest.taskId;
    onLogSelectedChange(selectedFlowExecuteId).catch(console.error);
    window.flowDispatchLog(providerId, connectionName, flowId, selectedFlowExecuteId).catch(console.error);
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

onMount(() => {
  if (latest) {
    window.flowDispatchLog(providerId, connectionName, flowId, latest?.taskId).catch(console.error);
  }
});

onDestroy(() => {
  flowExecuteUnsubscriber?.();
  flowCurrentLogUnsubscriber?.();
  logsTerminal?.clear();
  logsTerminal = undefined;
});

async function onLogSelectedChange(taskId: string): Promise<void> {
  if (taskId === selectedFlowExecuteId) {
    return; // do not change when selecting current
  }

  selectedFlowExecuteId = taskId;
  logsTerminal?.clear();
  await window.flowDispatchLog(providerId, connectionName, flowId, taskId);
}
</script>

<div class="h-full w-full flex flex-col gap-x-2 items-center">
  <div class="flex flex-row">
    <Dropdown
      class="text-sm"
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
