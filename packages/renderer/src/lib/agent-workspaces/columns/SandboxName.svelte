<script lang="ts">
import { Tooltip } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';

import type { SandboxInfo } from '/@api/openshell-gateway-info';

interface Props {
  object: SandboxInfo;
}

let { object }: Props = $props();

const isDeleting = $derived(object.phase === 'Deleting');

function openDetails(): void {
  if (!isDeleting) {
    router.goto(`/agent-workspaces/${encodeURIComponent(object.id)}/overview`);
  }
}
</script>

<button class="flex flex-col w-full text-left" onclick={openDetails} disabled={isDeleting} class:opacity-50={isDeleting} class:cursor-default={isDeleting}>
  <Tooltip top tip={object.sourcePath ?? object.name}>
    <div class="flex items-start">
      <div class="text-sm text-[var(--pd-table-body-text)]">{object.name}</div>
    </div>
  </Tooltip>
  <div class="text-xs text-[var(--pd-table-body-text-sub)]">ID: {object.id}</div>
</button>
