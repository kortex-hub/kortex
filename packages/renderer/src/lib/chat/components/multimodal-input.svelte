<script lang="ts">
import type { Chat } from '@ai-sdk/svelte';
import type { Attachment } from '@ai-sdk/ui-utils';
import { onMount, untrack } from 'svelte';
import type { SvelteMap } from 'svelte/reactivity';
import { innerWidth } from 'svelte/reactivity/window';
import { toast } from 'svelte-sonner';

import { EditState } from '/@/lib/chat/hooks/edit-state.svelte';
import { LocalStorage } from '/@/lib/chat/hooks/local-storage.svelte';
import { cn } from '/@/lib/chat/utils/shadcn';

import ExportButton from './ExportButton.svelte';
import ArrowUpIcon from './icons/arrow-up.svelte';
import PaperclipIcon from './icons/paperclip.svelte';
import StopIcon from './icons/stop.svelte';
import type { ModelInfo } from './model-info';
import PreviewAttachment from './preview-attachment.svelte';
import SuggestedActions from './suggested-actions.svelte';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

let {
  attachments = $bindable(),
  chatClient,
  class: c,
  selectedMCPTools,
  selectedModel,
}: {
  attachments: Attachment[];
  chatClient: Chat;
  class?: string;
  selectedMCPTools: SvelteMap<string, Set<string>>;
  selectedModel?: ModelInfo;
} = $props();

const editState = EditState.fromContext();

let input = $state('');
let savedInput = $state('');
let mounted = $state(false);
let textareaRef = $state<HTMLTextAreaElement | null>(null);
const storedInput = new LocalStorage('input', '');
const loading = $derived(chatClient.status === 'streaming' || chatClient.status === 'submitted');

$effect(() => {
  if (editState.editingMessage) {
    const text = editState.editingMessage.parts
      .filter(part => part.type === 'text')
      .map(part => (part as { type: 'text'; text: string }).text)
      .join('');
    untrack(() => {
      savedInput = input;
      input = text;
      // Wait for DOM to update before adjusting height
      requestAnimationFrame(() => {
        adjustHeight();
        if (textareaRef) {
          textareaRef.focus();
          // Set cursor to the end of the text
          textareaRef.setSelectionRange(textareaRef.value.length, textareaRef.value.length);
        }
      });
    });
  }
});

async function cancelEditing(): Promise<void> {
  editState.cancelEditing();
  input = savedInput;
  savedInput = '';

  // Wait for DOM to update before resetting height
  await new Promise(resolve => requestAnimationFrame(resolve));
  adjustHeight();
}

const adjustHeight = (): void => {
  if (textareaRef) {
    textareaRef.style.height = 'auto';
    // Let the browser recalculate scrollHeight for the current content
    const scrollHeight = textareaRef.scrollHeight;
    const maxHeight = window.innerHeight * 0.25;
    const newHeight = Math.min(scrollHeight + 2, maxHeight);
    textareaRef.style.height = `${newHeight}px`;
  }
};

const resetHeight = (): void => {
  adjustHeight();
};

function setInput(value: string): void {
  input = value;
  adjustHeight();
}

function canSubmit(): boolean {
  // When editing, only allow non-empty text (attachments are discarded in edit mode)
  if (editState.isEditing) {
    return input.trim().length > 0;
  }
  // When not editing, allow either text or attachments
  return input.trim().length > 0 || attachments.length > 0;
}

async function submitForm(): Promise<void> {
  if (!canSubmit()) {
    return;
  }
  const text = input;

  if (editState.editingMessage) {
    const editingMessage = editState.editingMessage;
    // Clear input directly instead of using setInput('') to avoid calling adjustHeight() before DOM updates
    input = '';
    savedInput = '';
    editState.cancelEditing();

    // Wait for DOM to update before resetting height
    await new Promise(resolve => requestAnimationFrame(resolve));
    resetHeight();

    await window.inferenceDeleteTrailingMessages(editingMessage.id);

    const index = chatClient.messages.findIndex(m => m.id === editingMessage.id);
    if (index !== -1) {
      const updatedMessage = {
        ...editingMessage,
        parts: [{ type: 'text' as const, text }],
      };
      chatClient.messages = [...chatClient.messages.slice(0, index), updatedMessage];
    }

    await chatClient.regenerate();
    return;
  }

  // Clear input directly instead of using setInput('') to avoid calling adjustHeight() before DOM updates
  input = '';

  // Wait for DOM to update before resetting height
  await new Promise(resolve => requestAnimationFrame(resolve));
  resetHeight();

  await chatClient.sendMessage({
    text,
    files: attachments.map(attachment => ({
      type: 'file',
      url: attachment.url,
      name: attachment.name,
      mediaType: attachment.contentType!,
    })),
  });

  attachments = [];

  if (innerWidth.current && innerWidth.current > 768) {
    textareaRef?.focus();
  }
}

function fileUrl(filePath: string): string {
  let pathName = filePath;
  pathName = pathName.replace(/\\/g, '/');

  // Windows drive letter must be prefixed with a slash.
  if (pathName[0] !== '/') {
    pathName = `/${pathName}`;
  }

  // Escape required characters for path components.
  // See: https://tools.ietf.org/html/rfc3986#section-3.3
  return encodeURI(`file://${pathName}`).replace(/[?#]/g, encodeURIComponent);
}

async function handleFile(): Promise<void> {
  const filepath = await window.openDialog({
    title: 'Select a file',
  });
  if (filepath?.[0]) {
    const mimeType = await window.pathMimeType(filepath?.[0]);
    const url = fileUrl(filepath?.[0]);
    attachments.push({
      url,
      name: url.substring(url.lastIndexOf('/') + 1),
      contentType: mimeType,
    });
  }
}

onMount(() => {
  input = storedInput.value;
  adjustHeight();
  mounted = true;
});

$effect.pre(() => {
  storedInput.value = input;
});

// Global ESC handler for edit mode
$effect((): (() => void) | void => {
  if (editState.isEditing) {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelEditing().catch(console.error);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }
});
</script>

<div class="relative flex w-full flex-col gap-4">
  {#if mounted && chatClient.messages.length === 0 && attachments.length === 0}
    <SuggestedActions {chatClient} {selectedMCPTools} />
  {/if}

  {#if attachments.length > 0}
    <div class="flex flex-row items-end gap-2 overflow-x-scroll">
      {#each attachments as attachment (attachment.url)}
        <PreviewAttachment {attachment} />
      {/each}
    </div>
  {/if}

  {#if editState.isEditing}
    <div class="text-muted-foreground px-3 pt-2 text-sm">Press ESC to cancel editing</div>
  {/if}

  <div class={cn(
    'bg-muted flex flex-col rounded-2xl border dark:border-zinc-700',
    c
  )}>
    <Textarea
      bind:ref={textareaRef}
      placeholder="Send a message..."
      bind:value={():string => input, setInput}
      class="max-h-[calc(25dvh)] min-h-[24px] resize-none overflow-y-auto border-0 bg-transparent text-base! shadow-none focus-visible:ring-0"
      rows={2}
      autofocus
      onkeydown={async(event): Promise<void> => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();

          if (loading) {
            toast.error('Please wait for the model to finish its response!');
          } else {
            await submitForm();
          }
        }
      }}
    />

    <div class="flex w-full flex-row items-center justify-between px-1 py-1">
      <div class="flex flex-row justify-start">
        <Button
          class="h-fit rounded-md rounded-bl-lg p-[7px] hover:bg-zinc-200 dark:border-zinc-700 hover:dark:bg-zinc-900"
          onclick={(event): void => {
            event.preventDefault();
            handleFile().catch(console.error);
          }}
          disabled={loading}
          variant="ghost"
          aria-label="Attach file"
          title="Attach file"
        >
          <PaperclipIcon size={14} />
        </Button>
      </div>

      <div class="flex flex-row items-center justify-end gap-2">
        <ExportButton {chatClient} {selectedModel} {loading} {selectedMCPTools}/>
        {#if loading}
          <Button
            aria-label="Stop generation"
            title="Stop generation"
            class="h-fit rounded-full border p-1.5 dark:border-zinc-600"
            onclick={async (event): Promise<void> => {
              event.preventDefault();
              await chatClient.stop();
            }}
          >
            <StopIcon size={14} />
          </Button>
        {:else}
          <Button
              aria-label="Send message"
              title="Send message"
              class="h-fit rounded-full border p-1.5 dark:border-zinc-600"
              onclick={async(event): Promise<void> => {
                event.preventDefault();
                await submitForm();
              }}
              disabled={!canSubmit()}
            >
            <ArrowUpIcon size={14} />
          </Button>
        {/if}
      </div>
    </div>
  </div>
</div>
