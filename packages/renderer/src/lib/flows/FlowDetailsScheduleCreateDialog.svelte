<script lang="ts">
import { Button, Input } from '@podman-desktop/ui-svelte';
import { toString } from 'cronstrue';

import Dialog from '/@/lib/dialogs/Dialog.svelte';

interface Props {
  flowId: string;
  providerId: string;
  connectionName: string;
  closeCallback: () => void;
}

let { closeCallback, flowId, providerId, connectionName }: Props = $props();

let cronExpression: string = $state('* */12 * * *');

let cronText: string = $derived.by(() => {
  try {
    return toString(cronExpression, { verbose: true, use24HourTimeFormat: true });
  } catch (e) {
    return 'Invalid cron expression';
  }
});

async function createSchedule(): Promise<void> {
  //TODO: the scheduler name should not be hardcoded
  await window.scheduleFlow('Native Scheduler', flowId, providerId, connectionName, cronExpression);
  closeCallback();
}
</script>



<Dialog
  title="Schedule Flow"
  onclose={closeCallback}>
  {#snippet content()}
    <div  class="flex flex-col text-sm leading-5 space-y-5">
      <div class="pb-4">
        <label for="Frequency" class="block mb-2 text-sm font-medium text-[var(--pd-modal-text)]">Frequency</label>
        <Input bind:value={cronExpression} id="Frequency" type="text" class="w-full p-2 border border-gray-300 rounded-md" placeholder="e.g., 0 0 * * *"/>
        <div class="mt-2 text-gray-600">
          {cronText}
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet buttons()}
    <Button class="w-auto" type="primary" on:click={createSchedule}>Create Schedule</Button>
        <Button class="w-auto" type="secondary" on:click={closeCallback}>Cancel</Button>
  {/snippet}
</Dialog>
