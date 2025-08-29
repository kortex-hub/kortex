<script lang="ts">
import { faPlay } from '@fortawesome/free-solid-svg-icons';

import { handleNavigation } from '/@/navigation';
import type { FlowInfo } from '/@api/flow-info';
import { NavigationPage } from '/@api/navigation-page';

import ListItemButtonIcon from '../ui/ListItemButtonIcon.svelte';

interface Props {
  object: FlowInfo;
}

const { object }: Props = $props();

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
</script>

<ListItemButtonIcon title="Run this recipe" icon={faPlay} onClick={executeFlow} />
