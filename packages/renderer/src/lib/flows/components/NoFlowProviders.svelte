<script lang="ts">
import { Button, Link } from '@podman-desktop/ui-svelte';
import { toast } from 'svelte-sonner';

import { combinedInstalledExtensions } from '/@/stores/all-installed-extensions';

interface Props {
  retryCheck: () => void;
}

let { retryCheck }: Props = $props();

async function restartAndCheck(): Promise<void> {
  if (extension) {
    if (extension.state === 'started' || extension.state === 'starting') {
      await window.stopExtension(extension.id);
    }
    await window.startExtension(extension.id);

    const maxAttempts = 300;
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (extension.state === 'started') {
        retryCheck();
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    toast.error(`Extension did not reach started state within timeout period`);
  }
}

let extension = $derived($combinedInstalledExtensions.find(e => e.id === 'kortex.goose'));
</script>

<div class="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
  <p class="text-lg">No flow providers installed</p>
  {#if extension}
    <div class="max-w-2xl space-y-4">
      <p class="text-gray-500">To get started with flows, please follow these steps:</p>
      
      <ol class="text-left text-gray-500 space-y-3 list-decimal list-inside">
        <li>Install the Goose CLI by running:
          <code class="block bg-gray-800 text-gray-200 p-2 mt-1 rounded font-mono text-sm">curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash</code>
        </li>
        <li class="flex items-center gap-2">Once the CLI is installed, restart the Goose extension using this button:
          <Button onclick={restartAndCheck}>Check</Button>
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
