<script lang="ts">
import type { SkillInfo } from '/@api/skill/skill-info';

interface Props {
  object: SkillInfo;
}

let { object }: Props = $props();
</script>

<div class="flex flex-col whitespace-nowrap max-w-full">
  <div class="flex items-center max-w-full">
    <div class="max-w-full">
      <div class="flex flex-nowrap max-w-full">
        <div
          class="text-[var(--pd-table-body-text-highlight)] overflow-hidden text-ellipsis"
          title={object.name}>
          {object.name}
        </div>
      </div>
    </div>
  </div>
</div>
