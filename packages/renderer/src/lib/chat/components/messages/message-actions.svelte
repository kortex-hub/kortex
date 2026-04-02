<script lang="ts">
import type { UIMessage } from '@ai-sdk/svelte';
import { onDestroy } from 'svelte';

import { EditState } from '/@/lib/chat/hooks/edit-state.svelte';
import { cn } from '/@/lib/chat/utils/shadcn';

import CheckCircleFillIcon from '../icons/check-circle-fill.svelte';
import CopyIcon from '../icons/copy.svelte';
import PencilEditIcon from '../icons/pencil-edit.svelte';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

let {
  message,
  readonly,
  alwaysVisible = false,
}: {
  message: UIMessage;
  readonly: boolean;
  alwaysVisible?: boolean;
} = $props();

const editState = EditState.fromContext();

let copied = $state(false);
let copiedResetTimer: ReturnType<typeof setTimeout> | undefined;

function getMessageText(): string {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

async function copyToClipboard(): Promise<void> {
  const text = getMessageText();
  if (copiedResetTimer) clearTimeout(copiedResetTimer);
  await window.clipboardWriteText(text);
  copied = true;
  copiedResetTimer = setTimeout(() => {
    copied = false;
    copiedResetTimer = undefined;
  }, 2000);
}

onDestroy(() => {
  if (copiedResetTimer) clearTimeout(copiedResetTimer);
});
</script>

<div
  class={cn(
    '-mt-3 flex items-center gap-0.5 transition-opacity',
    {
      'opacity-0 group-hover/message:opacity-100': !alwaysVisible,
      'justify-end': message.role === 'user',
      'justify-start': message.role === 'assistant',
    },
  )}
>
  {#if message.role === 'user' && !readonly}
    <Tooltip>
      <TooltipTrigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="ghost"
            class={cn('text-muted-foreground h-fit w-9 rounded-full p-1', {
              invisible: editState.isEditing,
            })}
            aria-label="Edit message"
            onclick={(): void => {
              editState.startEditing(message);
            }}
            disabled={editState.isEditing}
          >
            <PencilEditIcon />
          </Button>
        {/snippet}
      </TooltipTrigger>
      <TooltipContent>Edit message</TooltipContent>
    </Tooltip>
  {/if}

  {#key copied}
    <Tooltip>
      <TooltipTrigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="ghost"
            class="text-muted-foreground h-fit w-9 rounded-full p-1"
            aria-label="Copy message"
            onclick={copyToClipboard}
          >
            {#if copied}
              <CheckCircleFillIcon size="lg" />
            {:else}
              <CopyIcon size="lg" />
            {/if}
          </Button>
        {/snippet}
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied!' : 'Copy'}</TooltipContent>
    </Tooltip>
  {/key}
</div>
