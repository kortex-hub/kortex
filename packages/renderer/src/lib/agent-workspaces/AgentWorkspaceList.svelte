<script lang="ts">
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import {
  Button,
  FilteredEmptyScreen,
  NavPage,
  SearchInput,
  Table,
  TableColumn,
  TableDurationColumn,
  TableRow,
} from '@podman-desktop/ui-svelte';

import NoLogIcon from '/@/lib/ui/NoLogIcon.svelte';
import { handleNavigation } from '/@/navigation';
import { agentWorkspaces, type AgentWorkspaceSummaryUI } from '/@/stores/agent-workspaces.svelte';
import {
  allOpenshellSandboxes,
  filteredOpenshellSandboxes,
  type SandboxInfoWithGateway,
  searchPattern as sandboxSearchPattern,
} from '/@/stores/openshell-sandboxes';
import { NavigationPage } from '/@api/navigation-page';

import AgentWorkspaceEmptyScreen from './AgentWorkspaceEmptyScreen.svelte';
import AgentWorkspaceStatCards from './AgentWorkspaceStatCards.svelte';
import AgentWorkspaceActions from './columns/AgentWorkspaceActions.svelte';
import AgentWorkspaceContext from './columns/AgentWorkspaceContext.svelte';
import AgentWorkspaceName from './columns/AgentWorkspaceName.svelte';
import AgentWorkspaceRuntime from './columns/AgentWorkspaceRuntime.svelte';
import SandboxActions from './columns/SandboxActions.svelte';
import SandboxGateway from './columns/SandboxGateway.svelte';
import SandboxName from './columns/SandboxName.svelte';
import SandboxPhase from './columns/SandboxPhase.svelte';
import { ACTIVE_GROUP_LABEL, getReferenceTime, isActiveWorkspace, STOPPED_GROUP_LABEL } from './workspace-utils';

type WorkspaceSelectable = AgentWorkspaceSummaryUI & { selected: boolean };
type SandboxSelectable = SandboxInfoWithGateway & { selected: boolean };

let searchTerm = $state('');

// Sync searchTerm with sandbox store's searchPattern
$effect(() => {
  sandboxSearchPattern.set(searchTerm);
});

function navigateToCreate(): void {
  handleNavigation({ page: NavigationPage.AGENT_WORKSPACE_CREATE });
}

const filteredWorkspaces: WorkspaceSelectable[] = $derived.by(() => {
  const term = searchTerm.trim().toLowerCase();
  return $agentWorkspaces
    .filter(
      ws =>
        !term ||
        ws.name.toLowerCase().includes(term) ||
        ws.project.toLowerCase().includes(term) ||
        (ws.model?.toLowerCase().includes(term) ?? false),
    )
    .map(ws => ({ ...ws, selected: false }));
});

const filteredSandboxes: SandboxSelectable[] = $derived(
  $filteredOpenshellSandboxes.map(sandbox => ({ ...sandbox, selected: false })),
);

const activeWorkspaces = $derived(filteredWorkspaces.filter(isActiveWorkspace));
const stoppedWorkspaces = $derived(filteredWorkspaces.filter(ws => !isActiveWorkspace(ws)));

const hasBothGroups: boolean = $derived(activeWorkspaces.length > 0 && stoppedWorkspaces.length > 0);

const row = new TableRow<WorkspaceSelectable>({});

const nameColumn = new TableColumn<WorkspaceSelectable>('Workspace', {
  width: '3fr',
  renderer: AgentWorkspaceName,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

const contextColumn = new TableColumn<WorkspaceSelectable>('Context', {
  width: '2fr',
  renderer: AgentWorkspaceContext,
});

const runtimeColumn = new TableColumn<WorkspaceSelectable>('Runtime', {
  width: '1fr',
  renderer: AgentWorkspaceRuntime,
  comparator: (a, b): number => a.runtime.localeCompare(b.runtime),
});

const timeColumn = new TableColumn<WorkspaceSelectable, Date | undefined>('Time', {
  renderer: TableDurationColumn,
  renderMapping: (ws): Date | undefined => {
    const refTime = getReferenceTime(ws);
    return refTime ? new Date(refTime) : undefined;
  },
  comparator: (a, b): number => {
    return (getReferenceTime(a) ?? 0) - (getReferenceTime(b) ?? 0);
  },
});

const actionsColumn = new TableColumn<WorkspaceSelectable>('', {
  align: 'right',
  width: '90px',
  renderer: AgentWorkspaceActions,
  overflow: true,
});

const columns = [nameColumn, contextColumn, runtimeColumn, timeColumn, actionsColumn];

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
      <div class="px-5 pt-4 pb-4">
        <AgentWorkspaceStatCards workspaces={$agentWorkspaces} sandboxes={$allOpenshellSandboxes} />
        <SearchInput bind:searchTerm={searchTerm} title="Agentic Workspaces" />
      </div>

      <div class="flex flex-col min-w-full min-h-0 flex-1 overflow-auto">
        {#if filteredWorkspaces.length === 0}
          {#if searchTerm}
            <FilteredEmptyScreen icon={NoLogIcon} kind="sessions" bind:searchTerm={searchTerm} />
          {:else}
            <AgentWorkspaceEmptyScreen />
          {/if}
        {:else if !hasBothGroups}
          <div class="flex min-w-full">
            <Table
              kind="agent-workspaces"
              data={filteredWorkspaces}
              columns={columns}
              row={row}
              defaultSortColumn="Workspace"
            />
          </div>
        {:else}
          <div class="flex flex-col w-full">
            <div class="mx-5 pt-2 text-sm font-semibold uppercase tracking-wider text-[var(--pd-table-header-text)]">{ACTIVE_GROUP_LABEL}</div>
            <div class="flex min-w-full">
              <Table
                kind="agent-workspaces-active"
                data={activeWorkspaces}
                columns={columns}
                row={row}
                defaultSortColumn="Workspace"
              />
            </div>
            <div class="mx-5 pt-2 text-sm font-semibold uppercase tracking-wider text-[var(--pd-table-header-text)]">{STOPPED_GROUP_LABEL}</div>
            <div class="flex min-w-full">
              <Table
                kind="agent-workspaces-stopped"
                data={stoppedWorkspaces}
                columns={columns}
                row={row}
                defaultSortColumn="Workspace"
              />
            </div>
          </div>
        {/if}

        <!-- OpenShell Workspaces Section -->
        {#if filteredSandboxes.length > 0}
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
