<script lang="ts">
/* eslint-enable simple-import-sort/imports */
import humanizeDuration from 'humanize-duration';
import { tick } from 'svelte';
/* eslint-disable import/no-duplicates */
import { cubicInOut } from 'svelte/easing';
import { slide } from 'svelte/transition';

import { getLock } from '/@/lib/chat/hooks/lock.svelte';

import ChevronDownIcon from './icons/chevron-down.svelte';
import { Markdown } from './markdown';

let { loading, reasoningContent, hasText }: { loading: boolean; reasoningContent: string; hasText: boolean } = $props();
let expanded = $state(false);
const scrollLock = getLock('messages-scroll');

// Show "Reasoning..." only during reasoning phase (before text starts)
// Once text starts, reasoning is complete even if still loading
const isReasoning = $derived(loading && !hasText);

// Track reasoning duration
let startTime = $state<number | null>(null);
let endTime = $state<number | null>(null);

// Track when reasoning starts and ends
$effect(() => {
  if (isReasoning && startTime === null) {
    startTime = Date.now();
  } else if (!isReasoning && startTime !== null && endTime === null) {
    endTime = Date.now();
  }
});

const durationText = $derived(
  startTime && endTime ? humanizeDuration(endTime - startTime, { round: true, largest: 2 }) : null,
);

const reasoningLabel = $derived(
  isReasoning ? 'Reasoning...' : durationText ? `Reasoned for ${durationText}` : 'Reasoned for a few seconds',
);

function lockScrolling(): void {
  scrollLock.lockTransition();
}

function unlockScrolling(): void {
  tick()
    .then(() => {
      scrollLock.unlockTransition();
    })
    .catch((error: unknown) => {
      console.error('Unable to unlock scrolling', error);
    });
}
</script>

<div class="flex flex-col">
	<div class="flex flex-row items-center gap-2">
		<div class="font-medium">{reasoningLabel}</div>
		{#if reasoningContent}
			<button
				type="button"
				class="cursor-pointer transition-transform duration-200 -rotate-90"
				class:rotate-0={expanded}
				aria-expanded={expanded}
				aria-controls="reasoning-content"
				aria-label={expanded ? 'Collapse reasoning details' : 'Expand reasoning details'}
				onclick={(): void => {
					expanded = !expanded;
				}}
			>
				<ChevronDownIcon />
			</button>
		{/if}
	</div>

	{#if expanded}
		<div
			id="reasoning-content"
			transition:slide={{ duration: 200, easing: cubicInOut }}
			onintrostart={lockScrolling}
			onintroend={unlockScrolling}
			onoutrostart={lockScrolling}
			onoutroend={unlockScrolling}
			class="mt-4 mb-2 flex flex-col gap-4 border-l pl-4 text-zinc-600 dark:text-zinc-400"
		>
			<Markdown md={reasoningContent} />
		</div>
	{/if}
</div>
