<script lang="ts">
import type { AcpSessionInfo } from '/@api/acp-session-info';

interface Props {
  object: AcpSessionInfo;
}

let { object }: Props = $props();
</script>

<span class="text-[var(--pd-table-body-text)] text-sm">{object.sandboxName}</span>
