<script lang="ts">
import type { UIMessage } from '@ai-sdk/svelte';
import type { DynamicToolUIPart, UIDataTypes, UIMessagePart, UITools } from 'ai';

import MCPIcon from '/@/lib/images/MCPIcon.svelte';

import ToolParts from './messages/tool-parts.svelte';

let { messages }: { messages: UIMessage[] } = $props();

let open = $state(false);

function isDynamicTool(part: UIMessagePart<UIDataTypes, UITools>): part is DynamicToolUIPart {
  return part.type === 'dynamic-tool';
}

// Collect all assistant dynamic-tool parts per message
const toolsPerMessage = $derived(
  messages
    .filter(m => m.role === 'assistant')
    .map(m => ({
      id: m.id,
      tools: m.parts?.filter(isDynamicTool) ?? [],
    }))
    .filter(entry => entry.tools.length > 0),
);

function hideMcp(): void {
  open = false;
}

function showMcp(): void {
  open = true;
}
</script>

{#if open}
<div class="hidden lg:flex lg:flex-col lg:w-96 lg:min-w-96 border-l bg-background/50 h-full">
  <div class="flex items-center justify-between gap-2 px-3 py-2 border-b">
    <div class="flex items-center gap-2">
      <MCPIcon size={16} />
      <div class="text-sm font-medium">MCP</div>
    </div>
    <button
      class="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
      title="Hide MCP panel"
      aria-label="Hide MCP panel"
      onclick={hideMcp}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path d="M7 6l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M7 12l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>

  <div class="flex-1 overflow-y-auto p-3">
    {#if toolsPerMessage.length === 0}
      <div class="text-xs text-muted-foreground">No MCP activity yet.</div>
    {:else}
      <div class="flex flex-col gap-4">
        {#each toolsPerMessage as entry (entry.id)}
          <div class="rounded-md bg-background p-2 ring-1 ring-border" role="row">
            <ToolParts tools={entry.tools} />
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
{:else}
<!-- Collapsed rail to reopen the panel on lg+ screens -->
<div class="hidden lg:flex lg:flex-col lg:w-6 lg:min-w-6 border-l bg-background/50 h-full items-center justify-center">
  <button
    class="text-xs text-muted-foreground hover:text-foreground whitespace-pre-line"
    title="Show MCP panel"
    aria-label="Show MCP panel"
    onclick={showMcp}
  >
    M<br>C<br>P
  </button>
</div>
{/if}
