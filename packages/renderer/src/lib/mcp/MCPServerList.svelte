<script lang="ts">
import { Button, NavPage } from '@podman-desktop/ui-svelte';

import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';

import McpServerListRegistryInstall from './MCPServerListRegistryInstall.svelte';
import McpServerListRemoteReady from './MCPServerListRemoteReady.svelte';

interface Props {
  mode?: 'READY' | 'INSTALLABLE';
}

const { mode }: Props = $props();

let selectedTab = $state<'READY' | 'INSTALLABLE'>('INSTALLABLE');

$effect(() => {
  if (mode === 'READY') {
    selectedTab = 'READY';
  } else if (mode === 'INSTALLABLE') {
    selectedTab = 'INSTALLABLE';
  } else {
    // no mode selected, then use install if no remote mcp, else ready
    selectedTab = $mcpRemoteServerInfos.length > 0 ? 'READY' : 'INSTALLABLE';
  }
});
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
