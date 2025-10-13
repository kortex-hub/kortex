<script lang="ts">
import type { RagEnvironment } from '/@api/rag/rag-environment';

interface Props {
  object: RagEnvironment;
}

const { object }: Props = $props();
</script>

<div class="flex flex-row items-center">
  <div class="flex flex-col overflow-hidden">
    <div class="text-sm text-[var(--pd-table-body-text-highlight)]" title={object.name}>
      {object.name}
    </div>
  </div>
</div>
