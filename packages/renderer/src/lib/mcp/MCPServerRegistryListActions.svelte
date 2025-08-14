<script lang="ts">
import { faGear, faPlusCircle, faTrash } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '../ui/ListItemButtonIcon.svelte';
import type { MCPRegistryServerDetail } from '/@api/mcp/mcp-registry-server-entry';
import McpRegistryCreateFromRegistryModal from './MCPRegistryCreateFromRegistryModal.svelte';

export let object: MCPRegistryServerDetail;

let createFromRegistryModal = false;

function closeModals(): void {
  createFromRegistryModal = false;
}
</script>

{#if object.remotes?.length ?? 0 > 0}

 <ListItemButtonIcon
    title="Install Remote server"
    icon={faPlusCircle}
    onClick={() => createFromRegistryModal = true}
    />

{/if}

  {#if createFromRegistryModal}
    <McpRegistryCreateFromRegistryModal
      mcpRegistryServerDetail={object}
      closeCallback={closeModals} />
  {/if}
