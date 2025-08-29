<script lang="ts">
import { Link } from '@podman-desktop/ui-svelte';
</script>

<div class="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
  <p class="text-lg">No flow providers installed</p>
  <p class="text-gray-500">Please install a flow provider to start creating and managing flows.</p>
  <p class="text-gray-500">
    The recommended flow provider is
    <Link class="text-base" on:click={(): Promise<void> => window.openExternal('https://block.github.io/goose/')}>
      goose
    </Link>.
  </p>
</div>
