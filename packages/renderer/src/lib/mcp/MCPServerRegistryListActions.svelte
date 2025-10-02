<script lang="ts">
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import type { components } from '@kortex-hub/mcp-registry-types';

import { handleNavigation } from '/@/navigation';
import { NavigationPage } from '/@api/navigation-page';

import ListItemButtonIcon from '../ui/ListItemButtonIcon.svelte';

interface Props {
  object: components['schemas']['ServerDetail'] & { registryURL: string };
}

let { object }: Props = $props();

function createRegistry(): void {
  handleNavigation({
    page: NavigationPage.MCP_INSTALL_FROM_REGISTRY,
    parameters: {
      serverName: object.name,
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
