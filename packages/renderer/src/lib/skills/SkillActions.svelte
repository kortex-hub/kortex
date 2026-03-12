<script lang="ts">
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash';

import { withConfirmation } from '/@/lib/dialogs/messagebox-utils';
import type { SkillInfo } from '/@api/skill/skill-info';

import ListItemButtonIcon from '../ui/ListItemButtonIcon.svelte';

interface Props {
  object: SkillInfo;
  detailed?: boolean;
}

let { object, detailed = false }: Props = $props();

let deleting = $state(false);

function onUnregister(): void {
  withConfirmation(() => {
    deleting = true;
    window
      .unregisterSkill(object.name)
      .catch((err: unknown) => console.error('Error deleting skill:', err))
      .finally(() => {
        deleting = false;
      });
  }, `delete skill \`${object.name}\``);
}
</script>

<ListItemButtonIcon inProgress={deleting} title="Delete" icon={faTrash} onClick={onUnregister} {detailed} enabled={!deleting} />
