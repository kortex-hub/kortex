<script lang="ts">
import { faPencil } from '@fortawesome/free-solid-svg-icons/faPencil';
import { Button, Link, NavPage, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';

import FlowName from '/@/lib/flows/columns/FlowName.svelte';
import { handleNavigation } from '/@/navigation';
import { flowsInfos } from '/@/stores/flows';
import type { FlowInfo } from '/@api/flow-info';
import { NavigationPage } from '/@api/navigation-page';

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

let hasInstalledFlowProviders = $derived.by(async () => window.hasInstalledFlowProviders());
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
          <div class="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <p class="text-lg">No flow providers installed</p>
            <p class="text-gray-500">Please install a flow provider to start creating and managing flows.</p>
            <p class="text-gray-500">
              The recommended flow provider is
              <Link class="text-base" on:click={(): Promise<void> => window.openExternal('https://block.github.io/goose/')}>
                goose
              </Link>.
            </p>
          </div>
        {/if}
      {/await}
    </div>
  {/snippet}
</NavPage>
