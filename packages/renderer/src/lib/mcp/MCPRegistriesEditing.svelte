<script lang="ts">
import { faPlusCircle, faTrash } from '@fortawesome/free-solid-svg-icons';
import type * as containerDesktopAPI from '@kortex-app/api';
import { Button, ErrorMessage, Input, Link } from '@podman-desktop/ui-svelte';

import IconImage from '/@/lib/appearance/IconImage.svelte';
import Dialog from '/@/lib/dialogs/Dialog.svelte';
import { mcpRegistriesInfos, mcpRegistriesSuggestedInfos } from '/@/stores/mcp-registries';

// contains the original instances of MCP registries when user clicks
let originRegistries = $state<containerDesktopAPI.MCPRegistry[]>([]);

// login error responses
let errorResponses = $state<{ serverUrl: string; error: string }[]>([]);

interface Props {
  // show or hide new registry form
  showNewRegistryForm?: boolean;
}

let { showNewRegistryForm = false }: Props = $props();

// Busy flag while attempting login
let adding = $state(false);

// used when user tries to add new registry
const newRegistryRequest = $state<containerDesktopAPI.MCPRegistry>({
  serverUrl: '',
});

function setErrorResponse(serverUrl: string, message: string | undefined): void {
  if (message) {
    errorResponses = [...errorResponses, { serverUrl: serverUrl, error: message }];
  } else {
    errorResponses = errorResponses.filter(o => o.serverUrl !== serverUrl);
  }
}

async function addToMCPRegistry(registry: containerDesktopAPI.MCPRegistry): Promise<void> {
  adding = true;
  try {
    // use ... to avoid to give the proxy object
    await window.createMCPRegistry({ ...registry });
    setNewRegistryFormVisible(false);
  } catch (error: unknown) {
    setErrorResponse(registry.serverUrl, String(error));
  }
  adding = false;
}

function setNewRegistryFormVisible(visible: boolean): void {
  // Show the new registry form
  showNewRegistryForm = visible;
}

async function removeExistingRegistry(registry: containerDesktopAPI.MCPRegistry): Promise<void> {
  await window.unregisterMCPRegistry(registry);
}
</script>
<div class="flex flex-col min-w-full h-full" role="region">
  <div class="min-w-full px-5 py-4" role="region" aria-label="Header">
    <div class="flex flex-row">
      <Button onclick={(): void => setNewRegistryFormVisible(true)} icon={faPlusCircle} disabled={showNewRegistryForm}>
        Add MCP registry
      </Button>
    </div>
  </div>
  <div class="flex flex-row min-w-full h-full px-5 py-4 overflow-y-auto" role="region" aria-label="Content">
    <div class="flex flex-col grow max-w-[905px] mx-auto">

      <div class="container bg-[var(--pd-invert-content-card-bg)] rounded-md p-3">
      <!-- Registries table start -->
      <div class="w-full border-t border-b border-[var(--pd-content-text)]" role="table" aria-label="Registries">
        <div
          class="flex w-full space-x-2 text-sm font-semibold text-[var(--pd-table-header-text)]"
          role="rowgroup"
          aria-label="header">
          <div class="text-left py-4 uppercase w-2/5 pl-5" role="columnheader">Registry Location</div>
          <div class="text-left py-4 uppercase w-1/5" role="columnheader"></div>
        </div>

        {#each $mcpRegistriesInfos as registry, index (index)}
          <!-- containerDesktopAPI.MCPRegistry row start -->
          <div
            class="flex flex-col w-full border-t border-[var(--pd-content-text)] text-[var(--pd-invert-content-card-text)]"
            role="row"
            aria-label={registry.name ?? registry.serverUrl}>
            <div class="flex flex-row items-center pt-4 pb-3 space-x-2">
              <div class="pl-5 w-2/5" role="cell">
                <div class="flex w-full h-full">
                  <div class="flex items-center">
                    <!-- Only show if a "suggested" registry icon has been added -->
                    {#if registry.icon}
                      <IconImage image={registry.icon} class="w-6 h-6" alt={registry.name}></IconImage>
                    {/if}
                    {#if registry.name}
                      <span class="ml-2">
                        {registry.name}
                      </span>
                    {:else}
                      <span class="ml-2">
                        {registry.serverUrl.replace('https://', '')}
                      </span>
                    {/if}
                  </div>
                </div>
              </div>
                <div class="w-1/5 flex space-x-2" role="cell">
                {registry.serverUrl}
              </div>
              <div class="w-1/5 flex space-x-2 justify-end" role="cell">
                <!-- Add remove button-->
                <Button
                  icon={faTrash}
                  title="Remove MCP registry"
                  onclick={(): Promise<void> => removeExistingRegistry(registry)}
                  disabled={adding || originRegistries.some(r => r.serverUrl === registry.serverUrl)}>Remove</Button>
              </div>
            </div>
          </div>
          <div class="flex flex-row-reverse w-full pb-3 -mt-2">
            <span class="w-2/3 pl-4 font-bold">
              {#if originRegistries.some(r => r.serverUrl === registry.serverUrl)}
                {errorResponses.find(o => o.serverUrl === registry.serverUrl)?.error ?? ''}
              {/if}
            </span>
          </div>
          <!-- containerDesktopAPI.MCPRegistry row end -->
        {/each}

        {#each $mcpRegistriesSuggestedInfos as registry, i (i)}
          <!-- Add new registry form start -->
          <div
            class="flex flex-col w-full border-t border-[var(--pd-content-text)] text-[var(--pd-invert-content-card-text)]"
            role="row"
            aria-label={registry.name ? registry.name : registry.url}>
            <div class="flex flex-row items-center pt-4 pb-3 space-x-2">
              <div class="pl-5 w-2/5" role="cell">
                <div class="flex w-full h-full">
                  <div class="flex items-center">
                    {#if registry.icon}
                      <IconImage image={registry.icon} class="w-6 h-6" alt={registry.name}></IconImage>
                    {/if}
                    <!-- By default, just show the name, but if we go to add it, show the full URL including https -->
                    <span class="ml-2">
                        {registry.name}
                    </span>
                  </div>
                </div>
              </div>
              <div class="w-3/5" role="cell">
                    <Link on:click={(): Promise<void> => window.openExternal(registry.url)}>{registry.url}</Link>
              </div>
              <div class="w-1/5 flex space-x-2 justify-end" role="cell">
              </div>
            </div>
            <div class="flex flex-row w-full pb-3 -mt-2 pl-10">
                <span class="font-bold whitespace-pre-line">
                  {errorResponses.find(o => o.serverUrl === newRegistryRequest.serverUrl)?.error ?? ''}
                </span>
            </div>
          </div>
          <!-- Add new registry form end -->
        {/each}
      </div>
      <!-- Registries table end -->
      </div>
    </div>
  </div>
</div>

1
{#if showNewRegistryForm}
  <Dialog
    title="Add MCP Registry"
    onclose={(): void => {
      setNewRegistryFormVisible(false);
    }}>
    {#snippet content()}
        <div  class="flex flex-col text-[var(--pd-modal-text)] space-y-5">
        <div>
          <div>URL (HTTPS only)</div>
          <Input placeholder="Enter the URL of a registry" bind:value={newRegistryRequest.serverUrl}></Input>
        </div>

      </div>
      {/snippet}
    {#snippet validation()}
        <ErrorMessage error={errorResponses.find(o => o.serverUrl === newRegistryRequest.serverUrl)?.error ?? ''}
        ></ErrorMessage
        >
      {/snippet}
    {#snippet buttons()}

        <Button type="link" onclick={(): boolean => (showNewRegistryForm = false)}>Cancel</Button>
        <Button
          type="primary"
          disabled={!newRegistryRequest.serverUrl.trim()}
          inProgress={adding}
          onclick={(): Promise<void> => addToMCPRegistry(newRegistryRequest)}>Add</Button>

      {/snippet}
  </Dialog>
{/if}
