<script lang="ts">
import { Checkbox } from '@podman-desktop/ui-svelte';

import type { SkillInfo } from '/@api/skill/skill-info';

interface Props {
  object: SkillInfo;
}

let { object }: Props = $props();

let toggling = $state(false);

function onToggle(_checked: boolean): void {
  toggling = true;
  const promise = object.enabled ? window.disableSkill(object.name) : window.enableSkill(object.name);
  promise
    .catch((err: unknown) => console.error('Error toggling skill:', err))
    .finally(() => {
      toggling = false;
    });
}
</script>

<Checkbox checked={object.enabled} disabled={toggling} onclick={onToggle} title={object.enabled ? 'Disable skill' : 'Enable skill'} />
