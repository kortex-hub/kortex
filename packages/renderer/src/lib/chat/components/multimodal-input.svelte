<script lang="ts">
import { type Chat } from '@ai-sdk/svelte';
import type { Attachment } from '@ai-sdk/ui-utils';
import { onMount } from 'svelte';
import type { SvelteMap } from 'svelte/reactivity';
import { innerWidth } from 'svelte/reactivity/window';
import { toast } from 'svelte-sonner';

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
  selectedMCP,
  selectedMCPTools,
  selectedModel,
  mcpSelectorOpen = $bindable(),
}: {
  attachments: Attachment[];
  chatClient: Chat;
  class?: string;
  selectedMCPTools?: Map<string, Set<string>>;
  selectedMCP: MCPRemoteServerInfo[];
  selectedModel?: ModelInfo;
  mcpSelectorOpen: boolean;
} = $props();

let input = $state('');
let mounted = $state(false);
let textareaRef = $state<HTMLTextAreaElement | null>(null);
const storedInput = new LocalStorage('input', '');
const loading = $derived(chatClient.status === 'streaming' || chatClient.status === 'submitted');

const adjustHeight = (): void => {
  if (textareaRef) {
    textareaRef.style.height = 'auto';
    textareaRef.style.height = `${textareaRef.scrollHeight + 2}px`;
  }
};

const resetHeight = (): void => {
  if (textareaRef) {
    textareaRef.style.height = 'auto';
    textareaRef.style.height = '98px';
  }
};

function setInput(value: string): void {
  input = value;
  adjustHeight();
}

async function submitForm(): Promise<void> {
  const text = input;
  setInput('');
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
  resetHeight();

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
</script>

<div class="relative flex w-full flex-col gap-4">
	{#if mounted && chatClient.messages.length === 0 && attachments.length === 0}
		<SuggestedActions {chatClient} {selectedMCPTools} bind:mcpSelectorOpen={mcpSelectorOpen} />
	{/if}

	{#if attachments.length > 0}
		<div class="flex flex-row items-end gap-2 overflow-x-scroll">
			{#each attachments as attachment (attachment.url)}
				<PreviewAttachment {attachment} />
			{/each}

		</div>
	{/if}

	<Textarea
		bind:ref={textareaRef}
		placeholder="Send a message..."
		bind:value={():string => input, setInput}
		class={cn(
			'bg-muted max-h-[calc(75dvh)] min-h-[24px] resize-none overflow-hidden rounded-2xl pb-10 !text-base dark:border-zinc-700',
			c
		)}
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

	<div class="absolute bottom-0 flex w-fit flex-row justify-start p-2">

		<Button
			class="h-fit rounded-md rounded-bl-lg p-[7px] hover:bg-zinc-200 dark:border-zinc-700 hover:dark:bg-zinc-900"
			onclick={(event): void => {
				event.preventDefault();
				handleFile().catch(console.error);
			}}
			disabled={loading}
			variant="ghost"
		>
			<PaperclipIcon size={14} />
		</Button>
	</div>

	<div class="absolute right-0 bottom-0 flex w-fit flex-row items-center justify-end p-2">
		<ExportButton {chatClient} {selectedModel} {selectedMCP} {loading} {selectedMCPTools}/>
		{#if loading}
			<Button
				aria-label="Stop generation"
				class="h-fit rounded-full border p-1.5 dark:border-zinc-600"
				onclick={(event): void => {
					event.preventDefault();
					stop();
					chatClient.messages = chatClient.messages;
				}}
			>
				<StopIcon size={14} />
			</Button>
		{:else}
			<Button
					aria-label="Send message"
					class="h-fit rounded-full border p-1.5 dark:border-zinc-600"
					onclick={async(event): Promise<void> => {
						event.preventDefault();
						await submitForm();
					}}
					disabled={input.trim().length === 0}
				>
				<ArrowUpIcon size={14} />
			</Button>
		{/if}
	</div>
</div>
