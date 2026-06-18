<script lang="ts">
import { Tooltip } from '@podman-desktop/ui-svelte';

import type { SandboxInfo } from '/@api/openshell-gateway-info';

interface Props {
  object: SandboxInfo;
}

let { object }: Props = $props();
</script>

<div class="flex flex-col">
  <Tooltip top tip={object.sourcePath ?? object.name}>
    <div class="text-sm text-[var(--pd-table-body-text)]">{object.name}</div>
  </Tooltip>
  <div class="text-xs text-[var(--pd-table-body-text-sub)]">ID: {object.id}</div>
</div>
