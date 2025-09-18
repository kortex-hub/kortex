<script lang="ts">
import { faDownload } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';

import { handleNavigation } from '/@/navigation';
import type { MCPServerDetail } from '/@api/mcp/mcp-server-info';
import { NavigationPage } from '/@api/navigation-page';

interface Props {
  mcpsToInstall: readonly MCPServerDetail[];
}
let { mcpsToInstall }: Props = $props();
</script>

<div>
  <p class="text-sm font-medium">The following MCPs are required to use this suggestion:</p>
  <ul class="pt-2">
    {#each mcpsToInstall as mcp (mcp.id)}
      <li>
        <button
          class="w-full text-left p-2 rounded-md hover:bg-charcoal-600"
          onclick={(): void =>
            handleNavigation({
              page: NavigationPage.MCP_INSTALL_FROM_REGISTRY,
              parameters: { serverId: mcp.id ?? '' },
            })}>
            <div class='flex items-center'>
          <Fa icon={faDownload} class="mr-2" />
          {mcp.name}</div>
        </button>
      </li>
    {/each}
  </ul>
</div>
