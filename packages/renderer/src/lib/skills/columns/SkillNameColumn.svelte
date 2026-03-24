<script lang="ts">
import { handleNavigation } from '/@/navigation';
import { NavigationPage } from '/@api/navigation-page';
import type { SkillInfo } from '/@api/skill/skill-info';

interface Props {
  object: SkillInfo;
}

let { object }: Props = $props();

function openDetails(): void {
  handleNavigation({
    page: NavigationPage.SKILL_DETAILS,
    parameters: { name: object.name },
  });
}
</script>

<button
  class="flex flex-col text-left w-full overflow-hidden cursor-pointer bg-transparent border-none p-0"
  onclick={openDetails}>
  <div
    class="text-[var(--pd-table-body-text-highlight)] overflow-hidden text-ellipsis whitespace-nowrap max-w-full hover:underline"
    title={object.name}>
    {object.name}
  </div>
</button>
