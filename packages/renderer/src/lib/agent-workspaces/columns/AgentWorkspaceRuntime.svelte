<script lang="ts">
import type { AgentWorkspaceSummaryUI } from '/@/stores/agent-workspaces.svelte';

interface Props {
  object: AgentWorkspaceSummaryUI;
}

let { object }: Props = $props();
</script>

<span class="text-xs text-(--pd-table-body-text)">{object.runtime}</span>
