<script lang="ts">
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import {
  Button,
  Dropdown,
  EmptyScreen,
  FilteredEmptyScreen,
  NavPage,
  SearchInput,
  Table,
  TableColumn,
  TableDurationColumn,
  TableRow,
} from '@podman-desktop/ui-svelte';

import NotificationsBox from '/@/lib/dashboard/NotificationsBox.svelte';
import NoLogIcon from '/@/lib/ui/NoLogIcon.svelte';
import { handleNavigation } from '/@/navigation';
import { openshellGateways } from '/@/stores/openshell-gateways';
import {
  allOpenshellSandboxes,
  filteredOpenshellSandboxes,
  type SandboxInfoWithGateway,
  searchPattern as sandboxSearchPattern,
  selectedGateway as sandboxSelectedGateway,
} from '/@/stores/openshell-sandboxes';
import { NavigationPage } from '/@api/navigation-page';

import AgentWorkspaceEmptyScreen from './AgentWorkspaceEmptyScreen.svelte';
import AgentWorkspaceStatCards from './AgentWorkspaceStatCards.svelte';
import SandboxActions from './columns/SandboxActions.svelte';
import SandboxGateway from './columns/SandboxGateway.svelte';
import SandboxName from './columns/SandboxName.svelte';
import SandboxPhase from './columns/SandboxPhase.svelte';

type SandboxSelectable = SandboxInfoWithGateway & { selected: boolean };

let searchTerm = $state('');
let gatewayFilter = $state('');

// Sync searchTerm with sandbox store's searchPattern
$effect(() => {
  sandboxSearchPattern.set(searchTerm);
});

// Sync gatewayFilter with sandbox store's selectedGateway
$effect(() => {
  sandboxSelectedGateway.set(gatewayFilter);
});

const gatewayOptions = $derived.by(() => {
  const options: { label: string; value: string }[] = [{ label: 'All', value: '' }];
  for (const gateway of $openshellGateways) {
    options.push({ label: gateway.name, value: gateway.name });
  }
  return options;
});

const longestGatewayLabel = $derived(
  gatewayOptions.reduce((longest, option) => (option.label.length > longest.length ? option.label : longest), ''),
);

function navigateToCreate(): void {
  handleNavigation({ page: NavigationPage.AGENT_WORKSPACE_CREATE });
}

function clearGatewayFilter(): void {
  gatewayFilter = '';
}

const filteredSandboxes: SandboxSelectable[] = $derived(
  $filteredOpenshellSandboxes.map(sandbox => ({ ...sandbox, selected: false })),
);

const sandboxRow = new TableRow<SandboxSelectable>({});

const sandboxNameColumn = new TableColumn<SandboxSelectable>('Workspace', {
  width: '3fr',
  renderer: SandboxName,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

const sandboxPhaseColumn = new TableColumn<SandboxSelectable>('Phase', {
  width: '2fr',
  renderer: SandboxPhase,
  comparator: (a, b): number => a.phase.localeCompare(b.phase),
});

const sandboxGatewayColumn = new TableColumn<SandboxSelectable>('Gateway', {
  width: '1fr',
  renderer: SandboxGateway,
  comparator: (a, b): number => a.gatewayName.localeCompare(b.gatewayName),
});

const sandboxTimeColumn = new TableColumn<SandboxSelectable, Date | undefined>('Time', {
  renderer: TableDurationColumn,
  renderMapping: (sandbox): Date | undefined => {
    return sandbox.created_at ? new Date(sandbox.created_at) : undefined;
  },
  comparator: (a, b): number => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeA - timeB;
  },
});

const sandboxActionsColumn = new TableColumn<SandboxSelectable>('', {
  align: 'right',
  width: '90px',
  renderer: SandboxActions,
  overflow: true,
});

const sandboxColumns = [
  sandboxNameColumn,
  sandboxPhaseColumn,
  sandboxGatewayColumn,
  sandboxTimeColumn,
  sandboxActionsColumn,
];
</script>

<NavPage bind:searchTerm={searchTerm} searchEnabled={false} title="Agentic Workspaces">
  {#snippet additionalActions()}
    <Button icon={faPlus} onclick={navigateToCreate}>Create Workspace</Button>
  {/snippet}

  {#snippet content()}
    <div class="flex flex-col min-w-full h-full">
      <NotificationsBox />
      <div class="px-5 pt-4 pb-4">
        <AgentWorkspaceStatCards sandboxes={$allOpenshellSandboxes} />
        <div class="flex flex-row items-center gap-3">
          <div class="w-72">
            <SearchInput bind:searchTerm={searchTerm} title="Agentic Workspaces" />
          </div>
          {#if $openshellGateways.length > 1}
            <div class="inline-grid max-w-64">
              <div class="invisible col-start-1 row-start-1 flex items-center px-1 py-1 whitespace-nowrap" aria-hidden="true">
                <span class="mr-1">Gateway:</span>
                <span class="truncate">{longestGatewayLabel}</span>
                <span class="w-4 shrink-0"></span>
              </div>
              <Dropdown
                ariaLabel="Filter by gateway"
                id="gateway-filter"
                name="gateway-filter"
                class="col-start-1 row-start-1 whitespace-nowrap grow-0!"
                bind:value={gatewayFilter}
                options={gatewayOptions}>
                {#snippet left()}
                  <div class="mr-1 text-(--pd-input-field-placeholder-text)">Gateway:</div>
                {/snippet}
              </Dropdown>
            </div>
          {/if}
        </div>
      </div>

      <div class="flex flex-col min-w-full min-h-0 flex-1 overflow-auto">
        {#if filteredSandboxes.length === 0}
          {#if searchTerm}
            <FilteredEmptyScreen icon={NoLogIcon} kind="workspaces" bind:searchTerm={searchTerm} />
          {:else if gatewayFilter}
            <EmptyScreen
              icon={NoLogIcon}
              title="No workspaces on gateway '{gatewayFilter}'"
              message="This gateway has no workspaces yet. Create one or select a different gateway.">
              <Button type="link" onclick={clearGatewayFilter}>Show all gateways</Button>
            </EmptyScreen>
          {:else}
            <AgentWorkspaceEmptyScreen />
          {/if}
        {:else}
          <div class="flex flex-col w-full mt-8">
            <div class="mx-5 pt-2 pb-2 text-sm font-semibold uppercase tracking-wider text-[var(--pd-table-header-text)]">
              OpenShell Workspaces
            </div>
            <div class="flex min-w-full">
              <Table
                kind="openshell-workspaces"
                data={filteredSandboxes}
                columns={sandboxColumns}
                row={sandboxRow}
                defaultSortColumn="Workspace"
              />
            </div>
          </div>
        {/if}

      </div>
    </div>
  {/snippet}
</NavPage>
