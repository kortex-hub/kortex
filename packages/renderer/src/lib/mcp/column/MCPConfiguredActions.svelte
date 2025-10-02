<script lang="ts">
import { faLinkSlash, faPlug, faTrash } from '@fortawesome/free-solid-svg-icons';

import { withConfirmation } from '/@/lib/dialogs/messagebox-utils';
import type { MCPConfigInfo } from '/@api/mcp/mcp-config-info';

import ListItemButtonIcon from '../../ui/ListItemButtonIcon.svelte';

interface Props {
  object: MCPConfigInfo;
}

let { object }: Props = $props();

async function stop(): Promise<void> {
  await window.stopMCP(object.id);
}

async function start(): Promise<void> {
  await window.startMCP(object.id);
}

async function unregister(): Promise<void> {
  return withConfirmation(() => {
    return window.unregisterMCP(object.id);
  }, `delete configuration ${object.name}`);
}
</script>

{#if object.status === 'running'}
  <ListItemButtonIcon
    title="Stop Connection"
    icon={faLinkSlash}
    onClick={stop}
  />
{:else}
  <ListItemButtonIcon
    title="Start Connection"
    icon={faPlug}
    onClick={start}
  />
  <ListItemButtonIcon
    title="Delete Configuration"
    icon={faTrash}
    onClick={unregister}
  />
{/if}

