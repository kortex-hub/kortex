<script lang="ts">
import { Link } from '@podman-desktop/ui-svelte';

import { combinedInstalledExtensions } from '/@/stores/all-installed-extensions';

import InstallGooseCliLink from './InstallGooseCliLink.svelte';

let extension = $derived($combinedInstalledExtensions.find(e => e.id === 'kortex.goose'));
</script>

<div class="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
  <p class="text-lg">No flow providers installed</p>
  {#if extension}
    <div class="max-w-2xl space-y-4">
      <p class="text-gray-500">To get started with flows, please follow these steps:</p>
      
      <ol class="text-center text-gray-500 space-y-3 list-inside">
        <li>
          <InstallGooseCliLink/>
        </li>
      </ol>

      <p class="text-gray-500 mt-4">
        For more information about Goose, visit the
        <Link class="text-base" on:click={(): Promise<void> => window.openExternal('https://block.github.io/goose/')}>
          official documentation
        </Link>
      </p>
    </div>
  {:else}
    <p class="text-gray-500">Please install a flow provider to start creating and managing flows.</p>
  {/if}
</div>
