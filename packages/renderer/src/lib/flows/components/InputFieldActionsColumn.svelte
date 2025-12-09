<script lang="ts">
import { faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';

import type { InputField } from '/@/lib/flows/types/input-field';
import ListItemButtonIcon from '/@/lib/ui/ListItemButtonIcon.svelte';

interface ParameterWithCallbacks extends InputField {
  index: number;
  onEdit: (index: number, field: InputField) => void;
  onDelete: (index: number, field: InputField) => void;
}

interface Props {
  object: ParameterWithCallbacks;
}

let { object }: Props = $props();

function handleEdit(): void {
  object.onEdit(object.index, object);
}

function handleDelete(): void {
  object.onDelete(object.index, object);
}
</script>

<div class="flex justify-end gap-1">
  <ListItemButtonIcon
    title="Edit parameter"
    icon={faEdit}
    onClick={handleEdit}
  />
  <ListItemButtonIcon
    title="Delete parameter"
    icon={faTrash}
    onClick={handleDelete}
  />
</div>

