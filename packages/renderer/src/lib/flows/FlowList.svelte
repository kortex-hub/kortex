<script lang="ts">
import { faPencil } from '@fortawesome/free-solid-svg-icons/faPencil';
import { Button, NavPage, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';

import FlowName from '/@/lib/flows/columns/FlowName.svelte';
import { handleNavigation } from '/@/navigation';
import { isFlowConnectionAvailable } from '/@/stores/flow-provider';
import { flowsInfos } from '/@/stores/flows';
import type { FlowInfo } from '/@api/flow-info';
import { NavigationPage } from '/@api/navigation-page';

import FlowIcon from '../images/FlowIcon.svelte';
import EmptyFlowScreen from './components/EmptyFlowScreen.svelte';
import NoFlowProviders from './components/NoFlowProviders.svelte';
import { getFlowName } from './flow-utils';
import FlowActions from './FlowActions.svelte';

type FlowSelectable = FlowInfo & { selected: boolean };

const row = new TableRow<FlowSelectable>({
  selectable: (_): boolean => false,
});

const itemColumn = new TableColumn<FlowSelectable>('', {
  width: '40px',
  renderer: FlowIcon,
});

let pathColumn = new TableColumn<FlowSelectable>('Flow', {
  width: '2fr',
  renderer: FlowName,
  comparator: (a, b): number => getFlowName(a.path).localeCompare(getFlowName(b.path)),
});

const flowActions = new TableColumn<FlowSelectable>('Actions', {
  align: 'right',
  renderer: FlowActions,
  overflow: true,
});

const columns = [itemColumn, pathColumn, flowActions];

function key(flow: FlowSelectable): string {
  return flow.path;
}

function navigateToCreateFlow(): void {
  handleNavigation({
    page: NavigationPage.FLOW_CREATE,
  });
}
</script>

<NavPage searchEnabled={false} title="Flows">
  {#snippet additionalActions()}
    {#if $isFlowConnectionAvailable}
      <Button icon={faPencil} onclick={navigateToCreateFlow}>
        Create
      </Button>
      <Button onclick={window.refreshFlows}>
        Refresh
      </Button>
    {/if}
  {/snippet}

  {#snippet content()}
    <div class="w-full flex justify-center">
      {#if $isFlowConnectionAvailable}
        {#if $flowsInfos.length === 0}
          <EmptyFlowScreen onclick={navigateToCreateFlow} />
        {:else}
          <Table
            kind="flows"
            data={$flowsInfos.map((flow) => ({ ...flow, selected: false, name: flow.path }))}
            columns={columns}
            row={row}
            defaultSortColumn="Flow"
            key={key}
          />
        {/if}
      {:else}
        <NoFlowProviders />
      {/if}
    </div>
  {/snippet}
</NavPage>
