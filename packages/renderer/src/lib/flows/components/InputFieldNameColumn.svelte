<script lang="ts">
import type { InputField } from '/@/lib/flows/types/input-field';

interface Props {
  object: InputField;
}

let { object }: Props = $props();
</script>

<div class="flex flex-col">
  <div class="font-mono text-sm text-[var(--pd-table-body-text-highlight)]">
    {`{{${object.name}}}`}
  </div>
  <div class="text-sm text-[var(--pd-table-body-text-sub-secondary)]">{object.description}</div>
</div>

