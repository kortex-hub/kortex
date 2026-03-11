<script lang="ts">
import { faFolder, faGear } from '@fortawesome/free-solid-svg-icons';
import { Icon } from '@podman-desktop/ui-svelte/icons';

import type { AgentWorkspaceSummary } from '/@api/agent-workspace-info';

interface Props {
  workspace: AgentWorkspaceSummary;
}

let { workspace }: Props = $props();
</script>

<div
  class="flex flex-col gap-3 p-4 bg-(--pd-content-card-carousel-card-bg) hover:bg-(--pd-content-card-carousel-card-hover-bg) rounded-md"
  role="region"
  aria-label="workspace {workspace.name}">
  <div class="text-start">
    <span class="text-(--pd-invert-content-card-text) font-semibold text-base">{workspace.name}</span>
  </div>
  <div class="flex flex-col gap-2 text-sm">
    <div class="flex items-center gap-2 text-(--pd-invert-content-card-text)" title={workspace.paths.source}>
      <Icon icon={faFolder} class="shrink-0 opacity-70" />
      <span class="truncate">{workspace.paths.source}</span>
    </div>
    <div class="flex items-center gap-2 text-(--pd-invert-content-card-text)" title={workspace.paths.configuration}>
      <Icon icon={faGear} class="shrink-0 opacity-70" />
      <span class="truncate">{workspace.paths.configuration}</span>
    </div>
  </div>
</div>
