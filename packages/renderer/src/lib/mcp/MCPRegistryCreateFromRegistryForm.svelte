<script lang="ts">
import { FormPage } from '@podman-desktop/ui-svelte';
import type { components } from 'mcp-registry';
import { router } from 'tinro';

import McpIcon from '/@/lib/images/MCPIcon.svelte';
import type { MCPTarget } from '/@/lib/mcp/setup/mcp-target';
import MCPSetupDropdown from '/@/lib/mcp/setup/MCPSetupDropdown.svelte';
import PackageSetupForm from '/@/lib/mcp/setup/PackageSetupForm.svelte';
import RemoteSetupForm from '/@/lib/mcp/setup/RemoteSetupForm.svelte';
import { mcpRegistriesServerInfos } from '/@/stores/mcp-registry-servers';

interface Props {
  serverId: string;
}

const { serverId }: Props = $props();

let loading: boolean = $state(false);

const mcpRegistryServerDetail: components['schemas']['ServerDetail'] | undefined = $derived(
  $mcpRegistriesServerInfos.find(server => server.id === serverId),
);

let targets: Array<MCPTarget> = $derived([
  ...(mcpRegistryServerDetail?.remotes ?? []).map((remote, index) => ({ ...remote, index })),
  ...(mcpRegistryServerDetail?.packages ?? []).map((pack, index) => ({ ...pack, index })),
]);
let mcpTarget: MCPTarget | undefined = $state();

$effect(() => {
  // select default at index 0
  if (mcpTarget === undefined && targets.length > 0) {
    mcpTarget = targets[0];
  }
});

async function navigateToMcps(): Promise<void> {
  router.goto('/mcps?tab=READY');
}
</script>

{#if mcpRegistryServerDetail}
  <FormPage title="Adding {mcpRegistryServerDetail.name}" onclose={navigateToMcps}>
    {#snippet icon()}<McpIcon size={24} />{/snippet}
    {#snippet content()}
      <div class="p-5 min-w-full h-full flex flex-col text-sm space-y-5">
        <div class="flex flex-col pb-4 gap-x-2">
          <!-- selecting which remote / package to use -->
          {#if targets.length > 1}
            <span>Multiple options are available to setup {mcpRegistryServerDetail.name}</span>
            <MCPSetupDropdown
              bind:selected={mcpTarget}
              targets={targets}
            />
          {/if}

          {#if mcpTarget !== undefined}
            {#if 'url' in mcpTarget}  <!-- remote -->
              <RemoteSetupForm serverId={serverId} remoteIndex={mcpTarget.index} bind:loading={loading} object={mcpTarget}/>
            {:else} <!-- package -->
              <PackageSetupForm packageIndex={mcpTarget.index} bind:loading={loading} object={mcpTarget}/>
            {/if}
          {/if}
        </div>
      </div>
    {/snippet}
  </FormPage>
{/if}
