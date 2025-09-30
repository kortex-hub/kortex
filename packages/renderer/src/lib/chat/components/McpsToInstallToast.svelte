<script lang="ts">
import { faDownload } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';

import type { SuggestedMCP } from '/@/lib/chat/components/suggested-mcp';
import { handleNavigation } from '/@/navigation';
import { NavigationPage } from '/@api/navigation-page';

interface Props {
  mcpsToInstall: Array<SuggestedMCP>;
}
let { mcpsToInstall }: Props = $props();

function navigateToMCPForm(mcp: SuggestedMCP): void {
  handleNavigation({
    page: NavigationPage.MCP_INSTALL_FROM_REGISTRY,
    parameters: {
      serverId: mcp.serverId,
      registryURL: mcp.registryURL,
    },
  });
}
</script>

<div>
  <p class="text-sm font-medium">The following MCPs are required to use this suggestion:</p>
  <ul class="pt-2">
    {#each mcpsToInstall as mcp (mcp.serverId)}
      <li>
        <button
          class="w-full text-left p-2 rounded-md hover:bg-charcoal-600"
          onclick={navigateToMCPForm.bind(undefined, mcp)}>
            <div class='flex items-center'>
          <Fa icon={faDownload} class="mr-2" />
          {mcp.name}</div>
        </button>
      </li>
    {/each}
  </ul>
</div>
