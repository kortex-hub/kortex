<script lang="ts">
import type { UIMessage } from '@ai-sdk/svelte';
import type { DynamicToolUIPart, UIDataTypes, UIMessagePart, UITools } from 'ai';

import MCPIcon from '/@/lib/images/MCPIcon.svelte';

import ToolParts from './messages/tool-parts.svelte';

let { messages }: { messages: UIMessage[] } = $props();

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
</script>

<div class="hidden md:flex md:flex-col md:w-96 md:min-w-96 border-l bg-background/50 h-full">
  <div class="flex items-center gap-2 px-3 py-2 border-b">
    <MCPIcon size={16} />
    <div class="text-sm font-medium">MCP</div>
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
