<script lang="ts">
import { faTrash } from '@fortawesome/free-solid-svg-icons';

import { withConfirmation } from '/@/lib/dialogs/messagebox-utils';
import ListItemButtonIcon from '/@/lib/ui/ListItemButtonIcon.svelte';
import type { WorkspaceProjectInfo } from '/@api/workspace-project-info';

interface Props {
  object: WorkspaceProjectInfo;
}

let { object }: Props = $props();

function handleRemove(): void {
  withConfirmation(
    () => window.removeWorkspaceProject(object.id).catch(console.error),
    `remove project ${object.name}`,
  );
}
</script>

<ListItemButtonIcon
  title="Remove project"
  icon={faTrash}
  onClick={handleRemove} />
