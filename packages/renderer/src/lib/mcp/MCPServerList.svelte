<script lang="ts">
import { Button, NavPage } from '@podman-desktop/ui-svelte';

import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';

import McpRegistriesEditing from './MCPRegistriesEditing.svelte';
import McpServerListRemoteReady from './MCPServerListConfigured.svelte';
import MCPServerListRegistryAvailable from './MCPServerListRegistryAvailable.svelte';

interface Props {
  tab?: string;
}

const { tab }: Props = $props();

let container: HTMLDivElement;

let selectedTab = $state<'CONFIGURED' | 'INSTALLABLE' | 'REGISTRIES-EDITING'>(
  (tab ?? $mcpRemoteServerInfos.length) ? 'CONFIGURED' : 'INSTALLABLE',
);

let searchTerm = $state('');

function scrollToTop(): void {
  container.scrollTo({ top: 0, left: 0, behavior: 'smooth'});
}
</script>

<NavPage bind:searchTerm={searchTerm} title="MCP servers">
    {#snippet tabs()}
    <Button type="tab" on:click={(): string => selectedTab = 'CONFIGURED'} selected={selectedTab === 'CONFIGURED'}
      >Configured</Button>
    <Button type="tab" on:click={():string => selectedTab = 'INSTALLABLE'} selected={selectedTab === 'INSTALLABLE'}
      >Install</Button>
    <Button type="tab" on:click={():string => selectedTab = 'REGISTRIES-EDITING'} selected={selectedTab === 'REGISTRIES-EDITING'}
      >Edit registries</Button>
  {/snippet}

  {#snippet content()}
    <div bind:this={container} class="flex flex-col w-full h-full overflow-y-scroll">
      {#if selectedTab === 'CONFIGURED'}
        <McpServerListRemoteReady bind:filter={searchTerm}/>
      {:else if selectedTab === 'INSTALLABLE'}
        <MCPServerListRegistryAvailable scrollToTop={scrollToTop} bind:filter={searchTerm}/>
      {:else if selectedTab === 'REGISTRIES-EDITING'}
        <McpRegistriesEditing />
      {/if}
    </div>
  {/snippet}
</NavPage>
