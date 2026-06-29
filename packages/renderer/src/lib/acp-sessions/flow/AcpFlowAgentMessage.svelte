<script lang="ts">
import Markdown from '/@/lib/markdown/Markdown.svelte';
import type { AcpFlowAgentMessageEvent } from '/@api/acp-session-info';

interface Props {
  event: AcpFlowAgentMessageEvent;
}

let { event }: Props = $props();
</script>

<div class="rounded-lg bg-[var(--pd-content-card-bg)] border border-[var(--pd-content-divider)] px-4 py-3 text-sm text-[var(--pd-content-text)]">
  <Markdown markdown={event.text} />
</div>
