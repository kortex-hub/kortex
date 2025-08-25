<script lang="ts">
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import type { MCPServerConfig } from '@mastra/core/mcp';

import ListItemButtonIcon from '../ui/ListItemButtonIcon.svelte';
import McpRegistryCreateFromRegistryModal from './MCPRegistryCreateFromRegistryModal.svelte';

export let object: MCPServerConfig;

let createFromRegistryModal = false;

function closeModals(): void {
  createFromRegistryModal = false;
}
</script>

{#if (object.remotes?.length ?? 0) > 0}

 <ListItemButtonIcon
    title="Install Remote server"
    icon={faPlusCircle}
    onClick={(): boolean => createFromRegistryModal = true}
    />

{/if}

  {#if createFromRegistryModal}
    <McpRegistryCreateFromRegistryModal
      mcpRegistryServerDetail={object}
      closeCallback={closeModals} />
  {/if}
