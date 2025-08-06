<script lang="ts">
import { onMount } from 'svelte';

// webview HTML element used to communicate
let webviewElement: HTMLElement | undefined;
let preloadPath: string | undefined;

onMount(async () => {
  preloadPath = await window.getChatPreloadPath();

  // after 5s open the devtools
  setTimeout(() => {
    if (webviewElement && 'openDevTools' in webviewElement && typeof webviewElement.openDevTools === 'function') {
      webviewElement?.openDevTools();
    }
  }, 5000);
});
</script>

{#if preloadPath}
<webview
      bind:this={webviewElement}
      aria-label="Chat"
      role="document"
      src="http://localhost:3000"
      preload={preloadPath} style="height: 100%; width: 100%"></webview>
{/if}
