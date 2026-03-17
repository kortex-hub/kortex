<script lang="ts">
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { Button, NavPage } from '@podman-desktop/ui-svelte';

import { handleNavigation } from '/@/navigation';
import { agentWorkspaces } from '/@/stores/agent-workspaces';
import { NavigationPage } from '/@api/navigation-page';

import AgentWorkspaceCard from './AgentWorkspaceCard.svelte';
import AgentWorkspaceEmptyScreen from './AgentWorkspaceEmptyScreen.svelte';

function navigateToCreate(): void {
  handleNavigation({ page: NavigationPage.AGENT_WORKSPACE_CREATE });
}
</script>

<NavPage searchEnabled={false} title="Agent Workspaces">
  {#snippet additionalActions()}
    <Button icon={faPlus} onclick={navigateToCreate}>Create Workspace</Button>
    <span class="text-(--pd-content-text)">{$agentWorkspaces.length} total sessions</span>
  {/snippet}

  {#snippet content()}
    <div class="flex w-full h-full overflow-auto">
      {#if $agentWorkspaces.length === 0}
        <AgentWorkspaceEmptyScreen />
      {:else}
        <div class="grid grid-cols-3 gap-4 p-5 w-full h-fit">
          {#each $agentWorkspaces as workspace (workspace.id)}
            <AgentWorkspaceCard {workspace} />
          {/each}
        </div>
      {/if}
    </div>
  {/snippet}
</NavPage>
