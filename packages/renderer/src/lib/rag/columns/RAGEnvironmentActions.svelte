<script lang="ts">
import type { RagEnvironment } from '/@api/rag/rag-environment';

interface Props {
  object: RagEnvironment;
}

const { object }: Props = $props();

function handleStop(event: MouseEvent): void {
  event.stopPropagation();
  // TODO: Implement stop/start functionality
  console.log('Stop environment:', object.name);
}

function handleDelete(event: MouseEvent): void {
  event.stopPropagation();
  // TODO: Implement delete functionality
  console.log('Delete environment:', object.name);
}
</script>

<div class="flex items-center gap-2" onclick={(e) => e.stopPropagation()}>
  <button
    onclick={handleStop}
    class="inline-flex items-center justify-center w-7 h-7 rounded bg-transparent text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
    title="Stop"
    aria-label="Stop environment">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  </button>
  <button
    onclick={handleDelete}
    class="inline-flex items-center justify-center w-7 h-7 rounded bg-transparent text-gray-400 hover:bg-red-900/10 hover:text-red-400 transition-colors"
    title="Delete"
    aria-label="Delete environment">
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19,6v14a2,2 0,0,1-2,2H7a2,2 0,0,1-2-2V6m3,0V4a2,2 0,0,1,2-2h4a2,2 0,0,1,2,2v2" />
    </svg>
  </button>
</div>
