<script lang="ts">
import { faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';

import type { ParameterWithCallbacks } from '/@/lib/flows/components/InputFieldTable.svelte';
import ListItemButtonIcon from '/@/lib/ui/ListItemButtonIcon.svelte';

interface Props {
  object: ParameterWithCallbacks;
}

let { object }: Props = $props();
</script>

<div class="flex justify-end gap-1">
  <ListItemButtonIcon
    title="Edit parameter"
    icon={faEdit}
    onClick={object.onEdit}
  />
  <ListItemButtonIcon
    title="Delete parameter"
    icon={faTrash}
    onClick={object.onDelete}
  />
</div>

