<script lang="ts">
import type { Chat } from '@ai-sdk/svelte';
import type { SvelteSet } from 'svelte/reactivity';
import { fly } from 'svelte/transition';
import { toast } from 'svelte-sonner';

import { Button } from './ui/button';

let {
  chatClient,
  selectedMCP,
}: {
  chatClient: Chat;
  selectedMCP: SvelteSet<string>;
} = $props();

const suggestedActions = [
  {
    title: 'What are the last 5 issues of Github',
    label: 'repository podman-desktop/podman-desktop?',
    action: 'What are the last 5 issues of Github repository podman-desktop/podman-desktop?',
    requiredMcp: ['internal:123e4567-e89b-12d3-a456-426614172000:0:GitHub MCP server'],
  },
  {
    title: 'Write code to',
    label: `demonstrate djikstra's algorithm`,
    action: `Write code to demonstrate djikstra's algorithm`,
  },
  {
    title: 'Help me write an essay',
    label: `about silicon valley`,
    action: `Help me write an essay about silicon valley`,
  },
  {
    title: 'What is the weather like',
    label: 'in San Francisco?',
    action: 'What is the weather like in San Francisco?',
  },
];
</script>

<div class="grid w-full gap-2 sm:grid-cols-2">
	{#each suggestedActions as suggestedAction, i (suggestedAction.title)}
		<div
			in:fly|global={{ opacity: 0, y: 20, delay: 50 * i, duration: 400 }}
			class={i > 1 ? 'hidden sm:block' : 'block'}
		>
			<Button
				variant="ghost"
				onclick={async (): Promise<void> => {

					if (suggestedAction.requiredMcp?.some(m => !selectedMCP.has(m))) {
    					toast.error(`You need to enable the following MCP first: ${suggestedAction.requiredMcp.map(m => { const parts = m.split(':'); return parts[parts.length - 1]; }).join(', ')}`);
						return;
					}

      await chatClient.sendMessage({
						role: 'user',
						parts: [{text: suggestedAction.action, type: 'text' }],
					});
				}}
				class="h-auto w-full flex-1 items-start justify-start gap-1 rounded-xl border px-4 py-3.5 text-left text-sm sm:flex-col"
			>
				<span class="font-medium">{suggestedAction.title}</span>
				<span class="text-muted-foreground">
					{suggestedAction.label}
				</span>
			</Button>
		</div>
	{/each}
</div>
