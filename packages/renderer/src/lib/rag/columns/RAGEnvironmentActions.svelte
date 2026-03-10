<script lang="ts">
import { Icon } from '@podman-desktop/ui-svelte/icons';

import { withConfirmation } from '/@/lib/dialogs/messagebox-utils';
import type { RagEnvironment } from '/@api/rag/rag-environment';

interface Props {
  object: RagEnvironment;
}

const { object }: Props = $props();

function handleDelete(): void {
  withConfirmation(
    () => window.deleteRagEnvironment(object.name).catch(console.error),
    `delete environment ${object.name}`,
  );
}
</script>

<div class="flex items-center gap-2">
  <button
    onclick={handleDelete}
    class="inline-flex items-center justify-center w-7 h-7 rounded bg-transparent text-gray-400 hover:bg-red-900/10 hover:text-red-400 transition-colors"
    title="Delete"
    aria-label="Delete environment">
    <Icon icon="fas fa-trash"></Icon>
  </button>
</div>
