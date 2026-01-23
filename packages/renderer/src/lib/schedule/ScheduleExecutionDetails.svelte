<script lang="ts">
import type { ProviderScheduleExecution } from '@kortex-app/api';
import { EmptyScreen } from '@podman-desktop/ui-svelte';
import type { Terminal } from '@xterm/xterm';
import humanizeDuration from 'humanize-duration';

import ScheduleIcon from '/@/lib/images/ScheduleIcon.svelte';
import DetailsPage from '/@/lib/ui/DetailsPage.svelte';
import TerminalWindow from '/@/lib/ui/TerminalWindow.svelte';

interface Props {
  id: string;
  schedulerName: string;
}

const { id, schedulerName }: Props = $props();

let execution: ProviderScheduleExecution | undefined = $state(undefined);

let contentTerminal = $state<Terminal | undefined>(undefined);

$effect(() => {
  window
    .getSchedulerExecution(schedulerName, id)
    .then(value => {
      execution = value;
    })
    .catch((err: unknown) => {
      console.error('Failed to get scheduler execution', err);
    });
});

$effect(() => {
  if (execution && contentTerminal) {
    contentTerminal.clear();
    contentTerminal.write(execution.output);
  }
});
</script>



<DetailsPage title="Scheduler" subtitle={execution?.id} >
    {#snippet iconSnippet()}
      <ScheduleIcon />
    {/snippet}
       {#snippet contentSnippet()}

<div class="flex flex-col space-x-2 justify-end h-full">
  {#if execution}

    <div class="text-sm p-2">
      <p>Last execution: {execution.lastExecution}</p>
      <p>Exit code: {execution.exitCode}</p>
      <p>Duration: {humanizeDuration(execution.duration, { largest: 1, round: true })}</p>
    </div>
      <TerminalWindow class="h-full" bind:terminal={contentTerminal} convertEol disableStdIn />


    {:else}
    <EmptyScreen icon={ScheduleIcon} title="No execution found" detail="There is no execution details available for this schedule." />
  {/if}
  </div>
    {/snippet}
  </DetailsPage>

