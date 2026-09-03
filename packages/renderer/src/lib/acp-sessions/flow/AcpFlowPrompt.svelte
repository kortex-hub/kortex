<script lang="ts">
import { faPaperclip } from '@fortawesome/free-solid-svg-icons';
import { Icon } from '@podman-desktop/ui-svelte/icons';

import type { AcpFlowPromptEvent } from '/@api/acp-session-info';

interface Props {
  event: AcpFlowPromptEvent;
}

let { event }: Props = $props();
</script>

<div class="rounded-lg bg-[var(--pd-button-primary-bg)] px-4 py-3 text-sm text-[var(--pd-button-primary-text)] ml-auto max-w-[80%]">
  {#if event.attachments?.length}
    <div class="flex flex-wrap gap-1.5 mb-2">
      {#each event.attachments as attachment (attachment.fileName)}
        <span class="inline-flex items-center gap-1 rounded-full bg-white/20 text-xs px-2 py-0.5">
          <Icon icon={faPaperclip} class="text-[10px]" />
          {attachment.fileName}
        </span>
      {/each}
    </div>
  {/if}
  <span class="whitespace-pre-wrap">{event.text}</span>
</div>
