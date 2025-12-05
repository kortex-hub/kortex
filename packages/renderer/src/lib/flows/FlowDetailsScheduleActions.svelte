<script lang="ts">
import { faFileLines } from '@fortawesome/free-solid-svg-icons';
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash';
import { router } from 'tinro';

import { withConfirmation } from '/@/lib/dialogs/messagebox-utils';
import ListItemButtonIcon from '/@/lib/ui/ListItemButtonIcon.svelte';
import type { FlowScheduleInfo } from '/@api/flow-schedule-info';

interface Props {
  object: FlowScheduleInfo;
}

const { object }: Props = $props();

let loading: boolean = $state(false);

async function deleteSchedule(): Promise<void> {
  withConfirmation(async () => {
    loading = true;
    try {
      await window.deleteSchedule(object.schedulerName, object.id);
    } catch (err: unknown) {
      console.error('Error deleting schedule:', err);
    } finally {
      loading = false;
    }
  }, `delete schedule ${object.id}`);
}

function showExecution(): void {
  router.goto(`/schedules/${encodeURIComponent(object.schedulerName)}/${encodeURIComponent(object.id)}`);
}
</script>

<ListItemButtonIcon inProgress={loading} title="Delete" icon={faTrash} onClick={deleteSchedule} />
<ListItemButtonIcon inProgress={loading} title="Show" icon={faFileLines} onClick={showExecution} />
