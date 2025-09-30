<script lang="ts">
import type { components } from '@kortex-hub/mcp-registry-types';
import { ErrorMessage, FormPage } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';
import { router } from 'tinro';

import McpIcon from '/@/lib/images/MCPIcon.svelte';
import type { MCPTarget } from '/@/lib/mcp/setup/mcp-target';
import MCPSetupDropdown from '/@/lib/mcp/setup/MCPSetupDropdown.svelte';
import RemoteSetupForm from '/@/lib/mcp/setup/RemoteSetupForm.svelte';
import type { MCPSetupOptions } from '/@api/mcp/mcp-setup';

interface Props {
  registryURL: string;
  serverId: string;
}

const { registryURL, serverId }: Props = $props();

let loading: boolean = $state(false);
let error: string | undefined = $state(undefined);

let serverDetails: components['schemas']['ServerDetail'] | undefined = $state();

onMount(() => {
  /**
   * Collect the server details
   */
  window
    .getMCPServerDetails(registryURL, serverId)
    .then(details => {
      serverDetails = details;
    })
    .catch(console.error);
});

let targets: Array<MCPTarget> = $derived([
  ...(serverDetails?.remotes ?? []).map((remote, index) => ({ ...remote, index })),
  ...(serverDetails?.packages ?? []).map((pack, index) => ({ ...pack, index })),
]);
let mcpTarget: MCPTarget | undefined = $state();

$effect(() => {
  // select default at index 0
  if (mcpTarget === undefined && targets.length > 0) {
    mcpTarget = targets[0];
  }
});

async function submit(options: MCPSetupOptions): Promise<void> {
  try {
    loading = true;
    error = undefined;
    const configId = await window.setupMCP(registryURL, serverId, options);
    console.log('configId', configId);
    return navigateToMcps();
  } catch (err: unknown) {
    error = String(err);
  } finally {
    loading = false;
  }
}

async function navigateToMcps(): Promise<void> {
  router.goto('/mcps?tab=READY');
}
</script>

{#if serverDetails}
  <FormPage title="Adding {serverDetails.name}" inProgress={loading} onclose={navigateToMcps}>
    {#snippet icon()}<McpIcon size={24} />{/snippet}
    {#snippet content()}

      <div class="p-5 min-w-full h-full">

        <div class="bg-[var(--pd-content-card-bg)] p-6 space-y-2 lg:p-8 rounded-lg">
          <div class="flex flex-col gap-y-4">
            {#if error}
              <ErrorMessage error={error} />
            {/if}

            <!-- selecting which remote / package to use -->
            {#if targets.length > 1}
              <div class="bg-[var(--pd-content-bg)] rounded-md flex flex-col p-2 space-y-2">
                <label class="block mb-2 text-xl font-bold text-[var(--pd-content-card-header-text)]">MCP Server Type</label>
                <MCPSetupDropdown
                  bind:selected={mcpTarget}
                  targets={targets}
                />
              </div>
            {/if}

            <!-- display form -->
            {#if mcpTarget !== undefined}
              {#if 'url' in mcpTarget}  <!-- remote -->
                <RemoteSetupForm submit={submit} remoteIndex={mcpTarget.index} bind:loading={loading} object={mcpTarget}/>
              {:else} <!-- package -->
                <span>Not yet supported :p</span>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    {/snippet}
  </FormPage>
{/if}
