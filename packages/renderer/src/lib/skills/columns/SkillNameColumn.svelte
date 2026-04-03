<script lang="ts">
import { Button } from '@podman-desktop/ui-svelte';

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

<Button
  type="link"
  onclick={openDetails}
  title={object.name}
  class="!p-0 !text-[var(--pd-table-body-text-highlight)] overflow-hidden text-ellipsis whitespace-nowrap max-w-full">
  {object.name}
</Button>
