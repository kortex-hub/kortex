<script lang="ts">
import type { UIMessage } from '@ai-sdk/svelte';
import type { DynamicToolUIPart } from 'ai';
import { fly } from 'svelte/transition';
import { toast } from 'svelte-sonner';
import { router } from 'tinro';

import { cn } from '/@/lib/chat/utils/shadcn';
import InstallGooseCliLink from '/@/lib/flows/components/InstallGooseCliLink.svelte';
import { flowCreationStore } from '/@/lib/flows/flowCreationStore';
import Markdown from '/@/lib/markdown/Markdown.svelte';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';

import PencilEditIcon from '../icons/pencil-edit.svelte';
import PlusIcon from '../icons/plus.svelte';
import SparklesIcon from '../icons/sparkles.svelte';
import MessageReasoning from '../message-reasoning.svelte';
import type { ModelInfo } from '../model-info';
import PreviewAttachment from '../preview-attachment.svelte';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import ToolParts from './tool-parts.svelte';

let {
  message,
  readonly,
  loading,
  selectedModel,
  selectedMCP,
  allowExportAsFlow,
}: {
  message: UIMessage;
  readonly: boolean;
  loading: boolean;
  selectedModel?: ModelInfo;
  selectedMCP: MCPRemoteServerInfo[];
  allowExportAsFlow: boolean;
} = $props();

let mode = $state<'view' | 'edit'>('view');

const exportAsFlow = (): void => {
  if (!selectedModel) {
    toast.error(`There's no selected model to export as a flow.`);
    return;
  }

  const prompt = message.parts?.find(p => p.type === 'text')?.text;

  if (!prompt) {
    toast.error(`There's no user message to export as a flow.`);
    return;
  }

  flowCreationStore.set({
    prompt,
    model: selectedModel,
    mcp: selectedMCP,
  });

  router.goto('/flows/create');
};

const tools: Array<DynamicToolUIPart> = message.parts.filter(part => part?.type === 'dynamic-tool') ?? [];
</script>

<div
	class="group/message mx-auto w-full max-w-3xl px-4"
	data-role={message.role}
	in:fly|global={{ opacity: 0, y: 5 }}
>

	<div
		class={cn(
			'flex w-full gap-4 group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
			{
				'w-full': mode === 'edit',
				'group-data-[role=user]/message:w-fit': mode !== 'edit',
			}
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
						<PreviewAttachment {attachment} />
					{/each}
				</div>
			{/if}

			{#each message.parts as part, i (`${message.id}-${i}`)}
				{@const { type } = part}
				{#if type === 'reasoning'}
					<MessageReasoning {loading} reasoning={part.text} />
				{:else if type === 'text'}
					{#if mode === 'view'}
						<div class="flex flex-row items-start gap-2">
							{#if message.role === 'user' && !readonly}
								<Tooltip>
									<TooltipTrigger>
										{#snippet child({ props })}
											<Button
												{...props}
												variant="ghost"
												class="text-muted-foreground h-fit rounded-full px-2 opacity-0 group-hover/message:opacity-100"
												onclick={(): void => {
													mode = 'edit';
												}}
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
								<Markdown markdown={part.text} />
							</div>
								{#if message.role === 'user' }
									<Button
										class="h-fit rounded-md p-[7px] hover:bg-zinc-200 dark:border-zinc-700 hover:dark:bg-zinc-900"
										onclick={(event): void => {
											event.preventDefault();
											if (allowExportAsFlow) {
												exportAsFlow();
											} else {
												toast.error(InstallGooseCliLink);
											}
										}}
										disabled={loading}
										variant="ghost"
										title={allowExportAsFlow? 'Export as Flow' : 'Install flow provider to enable save.'}
									>
										<PlusIcon size={14}>
										</PlusIcon>
									</Button>
							{/if}
						</div>
					{:else if mode === 'edit'}
						<div class="flex flex-row items-start gap-2">
							<div class="size-8"></div>

							<!-- TODO -->
							<!-- <MessageEditor key={message.id} {message} {setMode} {setMessages} {reload} /> -->
						</div>
					{/if}

					<!-- TODO -->
					<!-- {:else if type === 'tool-invocation'}
					{@const { toolInvocation } = part}
					{@const { toolName, state } = toolInvocation}

					{#if state === 'call'}
						{@const { args } = toolInvocation}
						<div
							class={cn({
								skeleton: ['getWeather'].includes(toolName)
							})}
						>
							{#if toolName === 'getWeather'}
								<Weather />
							{:else if toolName === 'createDocument'}
								<DocumentPreview {readonly} {args} />
							{:else if toolName === 'updateDocument'}
								<DocumentToolCall type="update" {args} {readonly} />
							{:else if toolName === 'requestSuggestions'}
								<DocumentToolCall type="request-suggestions" {args} {readonly} />
							{/if}
						</div>
					{:else if state === 'result'}
					{@const { result } = toolInvocation}
						<div>
							{#if toolName === 'getWeather'}
								<Weather weatherAtLocation={result} />
							{:else if toolName === 'createDocument'}
								<DocumentPreview {readonly} {result} />
							{:else if toolName === 'updateDocument'}
								<DocumentToolResult type="update" {result} {readonly} />
							{:else if toolName === 'requestSuggestions'}
								<DocumentToolResult type="request-suggestions" {result} {readonly} />
							{:else}
								<pre>{JSON.stringify(result, null, 2)}</pre>
							{/if}
						</div>
					{/if} -->
				{/if}
			{/each}

			<!-- TODO -->
			<!-- {#if !readonly}
				<MessageActions key={`action-${message.id}`} {chatId} {message} {vote} {isLoading} />
			{/if} -->
		</div>
	</div>
</div>
