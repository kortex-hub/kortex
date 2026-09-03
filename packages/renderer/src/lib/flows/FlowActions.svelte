<script lang="ts">
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash';

import { withConfirmation } from '/@/lib/dialogs/messagebox-utils';
import { handleNavigation } from '/@/navigation';
import type { FlowInfo } from '/@api/flow-info';
import { NavigationPage } from '/@api/navigation-page';

import ListItemButtonIcon from '../ui/ListItemButtonIcon.svelte';
import RunFlowModal from './RunFlowModal.svelte';

interface Props {
  object: FlowInfo;
  onLocalRun?: (flowExecuteId: string) => void;
}

const { object, onLocalRun }: Props = $props();

let loading: boolean = $state(false);
let showModal: boolean = $state(false);

function navigateToRunFlow(): void {
  handleNavigation({
    page: NavigationPage.FLOW_RUN,
    parameters: {
      providerId: object.providerId,
      connectionName: object.connectionName,
      flowId: object.id,
    },
  });
}

async function executeFlow(params?: Record<string, string>): Promise<void> {
  // execute the flow
  const flow = { providerId: object.providerId, connectionName: object.connectionName, flowId: object.id, params };
  const taskId: string = await window.flowExecute($state.snapshot(flow));
  // execute callback if any
  onLocalRun?.(taskId);

  // redirect to the run tab
  navigateToRunFlow();
}

async function handleRunClick(): Promise<void> {
  if (object.parameters && object.parameters.length > 0) {
    showModal = true;
  } else {
    await executeFlow({});
  }
}

async function handleModalRun(params: Record<string, string>): Promise<void> {
  showModal = false;
  await executeFlow(params);
}

function handleModalCancel(): void {
  showModal = false;
}

async function deleteFlow(): Promise<void> {
  withConfirmation(async () => {
    loading = true;
    try {
      await window.deleteFlow(object.providerId, object.connectionName, object.id);
    } catch (err: unknown) {
      console.error('Error deleting flow:', err);
    } finally {
      loading = false;
      handleNavigation({ page: NavigationPage.FLOWS });
    }
  }, `delete ${object.path}`);
}
</script>

<ListItemButtonIcon title="Run this recipe" icon={faPlay} onClick={handleRunClick} />
<ListItemButtonIcon inProgress={loading} title="Delete" icon={faTrash} onClick={deleteFlow} />

{#if showModal}
  <RunFlowModal
    flow={object}
    onRun={handleModalRun}
    onCancel={handleModalCancel}
  />
{/if}
