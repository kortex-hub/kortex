<script lang="ts">
import type { UIMessage } from '@ai-sdk/svelte';
import { onMount } from 'svelte';

import { getLock } from '/@/lib/chat/hooks/lock.svelte';

import Overview from './messages/overview.svelte';
import PreviewMessage from './messages/preview-message.svelte';
import ThinkingMessage from './messages/thinking-message.svelte';

let containerRef = $state<HTMLDivElement | null>(null);
let endRef = $state<HTMLDivElement | null>(null);

let {
  readonly,
  loading,
  messages,
}: {
  readonly: boolean;
  loading: boolean;
  messages: UIMessage[];
} = $props();

let mounted = $state(false);

onMount(async () => {
  mounted = true;
});

const scrollLock = getLock('messages-scroll');

const updateScrollLock = (): void => {
  if (!containerRef) return;

  const { scrollTop, scrollHeight, clientHeight } = containerRef;
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

  // Consider "at bottom" if within 50px of the bottom
  const isAtBottom = distanceFromBottom <= 50;

  scrollLock.userScrolledAway = !isAtBottom;
};

// Clear user scroll lock when loading starts (e.g., after editing a message)
$effect(() => {
  if (loading) {
    scrollLock.userScrolledAway = false;
  }
});

$effect(() => {
  if (!containerRef) return;

  // Update lock state on user scroll
  containerRef.addEventListener('scroll', updateScrollLock);

  return (): void => {
    containerRef?.removeEventListener('scroll', updateScrollLock);
  };
});

$effect(() => {
  if (!(containerRef && endRef)) return;

  const observer = new MutationObserver(() => {
    if (!endRef || scrollLock.locked) return;
    endRef.scrollIntoView({ behavior: 'instant', block: 'end' });
    // Update lock state after auto-scroll
    updateScrollLock();
  });

  observer.observe(containerRef, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  return (): void => observer.disconnect();
});
</script>

<div bind:this={containerRef} class="flex min-w-0 flex-1 flex-col gap-6 overflow-y-scroll pt-4">
	{#if mounted && messages.length === 0}
		<Overview />
	{/if}

	{#each messages as message (message.id)}
		<PreviewMessage {message} {messages} {readonly} {loading}/>
	{/each}

	{#if loading && messages.length > 0 && messages[messages.length - 1].role === 'user'}
		<ThinkingMessage />
	{/if}

	<div bind:this={endRef} class="min-h-[24px] min-w-[24px] shrink-0"></div>
</div>
