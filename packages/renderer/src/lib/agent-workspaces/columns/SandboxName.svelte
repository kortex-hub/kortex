<script lang="ts">
import type { SandboxInfo } from '/@api/openshell-gateway-info';

interface Props {
  object: SandboxInfo;
}

let { object }: Props = $props();
</script>

<div class="flex flex-col">
  <div class="text-sm text-[var(--pd-table-body-text)]">{object.name}</div>
  <div class="text-xs text-[var(--pd-table-body-text-sub)]">ID: {object.id}</div>
</div>
