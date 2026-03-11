<script lang="ts">
import { NavPage } from '@podman-desktop/ui-svelte';

import { agentWorkspaces } from '/@/stores/agent-workspaces';

import AgentWorkspaceCard from './AgentWorkspaceCard.svelte';
import AgentWorkspaceEmptyScreen from './AgentWorkspaceEmptyScreen.svelte';
</script>

<NavPage searchEnabled={false} title="Agent Workspaces">
  {#snippet additionalActions()}
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
