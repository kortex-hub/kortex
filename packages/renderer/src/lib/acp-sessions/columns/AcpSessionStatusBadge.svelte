<script lang="ts">
import type { AcpSessionInfo, AcpSessionStatus } from '/@api/acp-session-info';

interface Props {
  object: AcpSessionInfo;
}

let { object }: Props = $props();

const STATUS_LABELS: Record<AcpSessionStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  waiting_input: 'Needs Input',
  completed: 'Completed',
  error: 'Error',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<AcpSessionStatus, string> = {
  idle: 'bg-[var(--pd-status-not-running)]',
  running: 'bg-[var(--pd-status-running)]',
  waiting_input: 'bg-[var(--pd-status-waiting)]',
  completed: 'bg-[var(--pd-status-terminated)]',
  error: 'bg-[var(--pd-status-dead)]',
  cancelled: 'bg-[var(--pd-status-not-running)]',
};
</script>

<div class="flex items-center gap-2">
  <span class="w-2 h-2 rounded-full shrink-0 {STATUS_COLORS[object.status]}"></span>
  <span class="text-[var(--pd-table-body-text)] text-sm">{STATUS_LABELS[object.status]}</span>
</div>
