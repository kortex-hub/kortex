<script lang="ts">
import { Icon } from '@podman-desktop/ui-svelte/icons';
import { router } from 'tinro';

import { getAgentDefinition } from '/@/lib/guided-setup/agent-registry';
import Badge from '/@/lib/ui/Badge.svelte';
import type { AgentWorkspaceSummaryUI } from '/@/stores/agent-workspaces.svelte';

interface Props {
  object: AgentWorkspaceSummaryUI;
}

let { object }: Props = $props();

const agentDef = $derived(getAgentDefinition(object.agent));
const agentLabel = $derived(agentDef.title);

function openDetails(): void {
  router.goto(`/agent-workspaces/${encodeURIComponent(object.id)}/overview`);
}
</script>

<div class="flex items-center gap-3 overflow-hidden max-w-full">
  {#if agentDef.iconComponent}
    <agentDef.iconComponent size={36} />
  {:else}
    <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 {agentDef.colorClass}">
      <Icon icon={agentDef.icon} size="1.5x" class="text-white" />
    </div>
  {/if}
  <div class="flex flex-col gap-1 overflow-hidden min-w-0">
    <button class="flex items-start" onclick={openDetails}>
      <span
        class="text-(--pd-table-body-text-highlight) text-[14px] font-semibold leading-normal overflow-hidden text-ellipsis whitespace-nowrap"
        title={object.name}>
        {object.name}
      </span>
    </button>
    <div class="flex items-center gap-1.5 flex-wrap">
      <Badge class="text-white" color="bg-(--pd-badge-sky)" label={agentLabel} />
    </div>
  </div>
</div>
