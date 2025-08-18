<script lang="ts">
import type { DynamicToolUIPart } from 'ai';
import { tick } from 'svelte';
import { cubicInOut } from 'svelte/easing';
import { slide } from 'svelte/transition';

import ChevronDownIcon from '/@/lib/chat/components/icons/chevron-down.svelte';
import { getLock } from '/@/lib/chat/hooks/lock';
import { SvelteSet } from 'svelte/reactivity';
import Fa from 'svelte-fa';
import { faToolbox } from '@fortawesome/free-solid-svg-icons/faToolbox';

interface Props {
  tools: Array<DynamicToolUIPart>
}

let { tools }: Props = $props();

let expanded: Set<string> = new SvelteSet();

const scrollLock = getLock('messages-scroll');

function lockScrolling(): void {
  scrollLock.locked = true;
}

function unlockScrolling(): void {
  tick().then(() => {
    scrollLock.locked = false;
  }).catch(console.error);
}
</script>

<div class="flex flex-col">
  {#each tools as tool (tool.toolCallId)}
    <div class="flex flex-row items-center gap-2">

      <Fa icon={faToolbox} />
      <div class="font-medium">{tool.toolName}</div>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="cursor-pointer"
        onclick={() => {
					if(expanded.has(tool.toolCallId)) {
            expanded.delete(tool.toolCallId);
					} else {
            expanded.add(tool.toolCallId);
					}
				}}
      >
        <ChevronDownIcon />
      </div>
    </div>

    {#if expanded.has(tool.toolCallId)}
      <div
        transition:slide={{ duration: 200, easing: cubicInOut }}
        onintrostart={lockScrolling}
        onintroend={unlockScrolling}
        onoutrostart={lockScrolling}
        onoutroend={unlockScrolling}
        class="mt-4 mb-2 flex flex-col gap-4 border-l pl-4 text-zinc-600 dark:text-zinc-400"
      >
        <span>Input</span>
        <code class="whitespace-pre-wrap overflow-aut">
          {JSON.stringify(tool.input,  null, 4)}
        </code>
        <span>Output</span>
        <code class="whitespace-pre-wrap overflow-auto">
          {JSON.stringify(tool.output, null, 4)}
        </code>
      </div>
    {/if}

  {/each}
</div>

