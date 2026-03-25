<script lang="ts">
import type { UIMessage } from '@ai-sdk/svelte';
import type { DynamicToolUIPart } from 'ai';
import { fly } from 'svelte/transition';

import { EditState } from '/@/lib/chat/hooks/edit-state.svelte';
import { fileUIPart2Attachment } from '/@/lib/chat/utils/chat';
import { cn } from '/@/lib/chat/utils/shadcn';
import Markdown from '/@/lib/markdown/Markdown.svelte';

import LoaderIcon from '../icons/loader.svelte';
import PencilEditIcon from '../icons/pencil-edit.svelte';
import SparklesIcon from '../icons/sparkles.svelte';
import MessageReasoning from '../message-reasoning.svelte';
import PreviewAttachment from '../preview-attachment.svelte';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import ToolParts from './tool-parts.svelte';

let {
  message,
  messages,
  readonly,
  loading,
}: {
  message: UIMessage;
  messages: UIMessage[];
  readonly: boolean;
  loading: boolean;
} = $props();

const editState = EditState.fromContext();

const isGrayed = $derived(editState.isAfterEditingMessage(messages, message));

const tools: Array<DynamicToolUIPart> = message.parts.filter(part => part?.type === 'dynamic-tool') ?? [];

// Separate reasoning and text parts for proper ordering
const reasoningParts = $derived(message.parts.filter(part => part.type === 'reasoning'));
const textParts = $derived(message.parts.filter(part => part.type === 'text'));
const hasText = $derived(textParts.some(part => part.text.trim().length > 0));

// Show spinner only for the last assistant message while loading (during reasoning or text generation)
const isLastMessage = $derived(messages.length > 0 && messages[messages.length - 1].id === message.id);
const isGeneratingResponse = $derived(loading && message.role === 'assistant' && isLastMessage);
</script>

<div
  class={cn('group/message mx-auto w-full max-w-3xl px-4', {
    'opacity-40 pointer-events-none': isGrayed,
  })}
  data-role={message.role}
  in:fly|global={{ opacity: 0, y: 5 }}
>

  <div
    class={cn(
      'flex w-full gap-4 group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
      'group-data-[role=user]/message:w-fit',
    )}
  >
    {#if message.role === 'assistant'}
      <div
        class="bg-background ring-border flex size-8 shrink-0 items-center justify-center rounded-full ring-1"
      >
        <div class="translate-y-px">
          <SparklesIcon size={14} />
        </div>
      </div>
    {/if}

    <div class="flex w-full flex-col gap-4">
      {#if message.role === 'assistant'}
        <!-- do we have tooling in parts ?-->
        {#if tools.length > 0}
          <ToolParts tools={tools} />
        {/if}
      {/if}

      {#if message.parts.filter(part => part.type === 'file').length > 0}
        <div class="flex flex-row justify-end gap-2">
          {#each message.parts.filter(part => part.type === 'file') as attachment (attachment.url)}
            <PreviewAttachment attachment={fileUIPart2Attachment(attachment)} />
          {/each}
        </div>
      {/if}

      <!-- Show reasoning first -->
      {#each reasoningParts as part, i (`${message.id}-reasoning-${i}`)}
        <MessageReasoning {loading} reasoningContent={part.text} {hasText} />
      {/each}

      <!-- Show text parts after reasoning -->
      {#each textParts as part, i (`${message.id}-text-${i}`)}
        <div class="flex flex-row items-center gap-2">
          {#if message.role === 'user' && !readonly}
            <Tooltip>
              <TooltipTrigger>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    variant="ghost"
                    class={cn(
                      'text-muted-foreground h-fit rounded-full px-2 opacity-0 group-hover/message:opacity-100',
                      { 'invisible': editState.isEditing }
                    )}
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
          <div
            class={cn('flex flex-col gap-4', {
              'bg-primary text-primary-foreground rounded-xl px-3 pt-4': message.role === 'user',
              'animate-fade-in': message.role === 'assistant',
            })}
          >
            <Markdown markdown={part.text} allowDangerousHtml={message.role !== 'user'} />
          </div>
        </div>
      {/each}

      <!-- Show spinner at the end while response is streaming (after reasoning completes) -->
      {#if isGeneratingResponse}
        <div class="flex">
          <div class="animate-spin">
            <LoaderIcon size={16} />
          </div>
        </div>
      {/if}

      <!-- TODO -->
      <!-- {#if !readonly}
        <MessageActions key={`action-${message.id}`} {chatId} {message} {vote} {isLoading} />
      {/if} -->
    </div>
  </div>
</div>
