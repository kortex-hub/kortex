<script lang="ts">
import { Dropdown } from '@podman-desktop/ui-svelte';
import type { Terminal } from '@xterm/xterm';
import { onDestroy, onMount } from 'svelte';
import type { Unsubscriber } from 'svelte/store';

import { flowCurrentLogInfo } from '/@/stores/flow-current-log';
import { executeFlowsInfo } from '/@/stores/flows-execute';
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

let flowExecuteUnsubscriber: Unsubscriber | undefined;
let flowCurrentLogUnsubscriber: Unsubscriber | undefined;

onMount(async () => {
  flowCurrentLogUnsubscriber = flowCurrentLogInfo.subscribe(log => {
    logsTerminal?.clear();
    logsTerminal?.write(log);
  });

  // when a new execute flow is added, select it
  flowExecuteUnsubscriber = executeFlowsInfo.subscribe(flows => {
    const matchingFlows = flows.filter(
      flow => flow.flowInfo.connectionName === connectionName && flow.flowInfo.providerId === providerId,
    );
    if (matchingFlows.length > 0) {
      const latestFlow = matchingFlows[matchingFlows.length - 1];
      if (latestFlow.taskId === dropDownFlowId) {
        return;
      }
      dropDownFlowId = latestFlow.taskId;
      onLogSelectedChange(dropDownFlowId).catch(console.error);
    }
  });
});

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
  <Dropdown
    class="text-sm"
    bind:value={dropDownFlowId}
    onChange={onLogSelectedChange}
    options={flowExecutions.map(flowExecution => ({
      value: flowExecution.taskId,
      label: flowExecution.taskId,
    }))}>
  </Dropdown>
  <TerminalWindow class="h-full w-full" bind:terminal={logsTerminal} convertEol disableStdIn />
</div>
