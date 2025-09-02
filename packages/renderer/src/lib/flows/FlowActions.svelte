<script lang="ts">
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash';

import { withConfirmation } from '/@/lib/dialogs/messagebox-utils';
import { handleNavigation } from '/@/navigation';
import type { FlowInfo } from '/@api/flow-info';
import { NavigationPage } from '/@api/navigation-page';

import ListItemButtonIcon from '../ui/ListItemButtonIcon.svelte';

interface Props {
  object: FlowInfo;
}

const { object }: Props = $props();

let loading: boolean = $state(false);

function navigateToCreateFlow(): void {
  handleNavigation({
    page: NavigationPage.FLOW_RUN,
    parameters: {
      providerId: object.providerId,
      connectionName: object.connectionName,
      flowId: object.id,
    },
  });
}

async function executeFlow(): Promise<void> {
  // execute the flow
  const flow = { providerId: object.providerId, connectionName: object.connectionName, flowId: object.id };
  window.flowExecute(flow).catch((error: unknown) => {
    console.error('Error executing flow:', error);
  });
  // redirect to the run tab
  navigateToCreateFlow();
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

<ListItemButtonIcon title="Run this recipe" icon={faPlay} onClick={executeFlow} />
<ListItemButtonIcon inProgress={loading} title="Delete" icon={faTrash} onClick={deleteFlow} />
