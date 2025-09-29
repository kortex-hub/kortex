<script lang="ts">
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import type { components } from '@kortex-hub/mcp-registry-types';

import { handleNavigation } from '/@/navigation';
import { NavigationPage } from '/@api/navigation-page';

import ListItemButtonIcon from '../ui/ListItemButtonIcon.svelte';

export let object: components['schemas']['ServerDetail'] & { registryURL: string };

function createRegistry(): void {
  const metadata = object._meta?.['io.modelcontextprotocol.registry/official'];
  if(!metadata) throw new Error('No metadata found for MCP registry server');

  handleNavigation({
    page: NavigationPage.MCP_INSTALL_FROM_REGISTRY, parameters: {
      serverId: metadata.serverId,
      registryURL: object.registryURL,
    },
  });
}
</script>

{#if (object.remotes?.length ?? 0) > 0}
 <ListItemButtonIcon
    title="Install Remote server"
    icon={faPlusCircle}
    onClick={createRegistry}
    />
{/if}
