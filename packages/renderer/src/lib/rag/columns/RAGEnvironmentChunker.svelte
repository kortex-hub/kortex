<script lang="ts">
import type { RagEnvironment } from '/@api/rag/rag-environment';

interface Props {
  object: RagEnvironment;
}

const { object }: Props = $props();

// Extract chunker name from ID or show the ID
const chunkerName = object.chunkerId;
</script>

<div class="flex items-center">
  <span
    class="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
    <div class="w-4 h-4 flex-shrink-0 rounded-sm bg-gradient-to-br from-orange-500 to-yellow-500"></div>
    <span>{chunkerName}</span>
  </span>
</div>
