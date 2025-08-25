<script lang="ts">
import { Button, NavPage } from '@podman-desktop/ui-svelte';

import McpServerListRegistryInstall from './MCPServerListRegistryInstall.svelte';
import McpServerListRemoteReady from './MCPServerListRemoteReady.svelte';

let selectedTab = $state<'READY' | 'INSTALLABLE'>('READY');
</script>

<NavPage searchEnabled={false} title="MCP servers">

    {#snippet tabs()}
    <Button type="tab" on:click={(): string => selectedTab = 'READY'} selected={selectedTab === 'READY'}
      >Ready</Button>
    <Button type="tab" on:click={():string => selectedTab = 'INSTALLABLE'} selected={selectedTab === 'INSTALLABLE'}
      >Install</Button>
  {/snippet}

  {#snippet content()}
  <div class="flex min-w-full h-full">
      {#if selectedTab === 'READY'}
        <McpServerListRemoteReady />
      {:else if selectedTab === 'INSTALLABLE'}
        <McpServerListRegistryInstall />
        {/if}


    </div>

  {/snippet}
</NavPage>
