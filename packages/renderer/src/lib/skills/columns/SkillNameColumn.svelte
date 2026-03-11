<script lang="ts">
import type { SkillInfo } from '/@api/skill/skill-info';

interface Props {
  object: SkillInfo;
}

let { object }: Props = $props();
</script>

<div
  class="text-[var(--pd-table-body-text-highlight)] overflow-hidden text-ellipsis whitespace-nowrap max-w-full"
  title={object.name}>
  {object.name}
</div>
