<script lang="ts">
import { faPencil } from '@fortawesome/free-solid-svg-icons/faPencil';
import { Button, NavPage, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';

import FlowName from '/@/lib/flows/columns/FlowName.svelte';
import { handleNavigation } from '/@/navigation';
import { flowsInfos } from '/@/stores/flows';
import type { FlowInfo } from '/@api/flow-info';
import { NavigationPage } from '/@api/navigation-page';

import NoFlowProviders from './components/NoFlowProviders.svelte';

type FlowSelectable = FlowInfo & { selected: boolean };

const row = new TableRow<FlowSelectable>({
  selectable: (_): boolean => false,
});

let pathColumn = new TableColumn<FlowSelectable>('Path', {
  width: '2fr',
  renderer: FlowName,
});

const columns = [pathColumn];

function key(flow: FlowSelectable): string {
  return flow.path;
}

function navigateToCreateFlow(): void {
  handleNavigation({
    page: NavigationPage.FLOW_CREATE,
  });
}

let hasInstalledFlowProviders = $derived(window.hasInstalledFlowProviders());
</script>

<NavPage searchEnabled={false} title="Flows">
  {#snippet additionalActions()}
    {#await hasInstalledFlowProviders then hasInstalledFlowProvidersC}
      {#if hasInstalledFlowProvidersC}
        <Button icon={faPencil} onclick={navigateToCreateFlow}>
          Create
        </Button>
        <Button onclick={window.refreshFlows}>
          Refresh
        </Button>
      {/if}
    {/await}
  {/snippet}

  {#snippet content()}
    <div class="w-full flex justify-center">
      {#await hasInstalledFlowProviders then hasInstalledFlowProvidersC}
        {#if hasInstalledFlowProvidersC}
          <div class="w-full max-w-6xl">
            <Table
              kind="flows"
              data={$flowsInfos.map((flow) => ({ ...flow, selected: false, name: flow.path }))}
              columns={columns}
              row={row}
              defaultSortColumn="Path"
              key={key}
            />
          </div>
        {:else}
          <NoFlowProviders />
        {/if}
      {/await}
    </div>
  {/snippet}
</NavPage>
