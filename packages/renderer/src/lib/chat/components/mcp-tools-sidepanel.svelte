<script lang="ts">
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';
import { faToolbox } from '@fortawesome/free-solid-svg-icons/faToolbox';
import type { SvelteMap } from 'svelte/reactivity';
import { SvelteSet } from 'svelte/reactivity';
import Fa from 'svelte-fa';

import { Input } from '/@/lib/chat/components/ui/input';
import MCPIcon from '/@/lib/images/MCPIcon.svelte';
import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';

import McpFilterCard from './mcp-filter-card.svelte';

interface Props {
  mcpSelectorOpen: boolean;
  searchTerm: string;
  selectedMCPTools: SvelteMap<string, Set<string>>;
  onCheckMCPTool: (mcpId: string, toolId: string, checked: boolean) => void;
}

let { mcpSelectorOpen = $bindable(), searchTerm = $bindable(''), selectedMCPTools, onCheckMCPTool }: Props = $props();

function onCheck(mcp: MCPRemoteServerInfo, checked: boolean): void {
  // eslint-disable-next-line sonarjs/no-selector-parameter
  if (!checked && selectedMCPTools.has(mcp.id)) {
    selectedMCPTools.delete(mcp.id);
  } else {
    selectedMCPTools.set(mcp.id, new SvelteSet(Object.keys(mcp.tools)));
  }
}

function hideMcp(): void {
  mcpSelectorOpen = false;
}

function showMcp(): void {
  mcpSelectorOpen = true;
}
</script>

{#if mcpSelectorOpen}
  <div class="hidden lg:flex lg:flex-col lg:w-64 lg:min-w-64 border-l bg-background/50 h-full overflow-y-scroll">
    <div class="flex items-center justify-between gap-2 px-3 py-2 border-b">
      <div class="flex items-center gap-2">
        <MCPIcon size={16} />
        <div class="text-sm font-medium">Tools</div>
      </div>
      <button
        class="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
        title="Hide MCP panel"
        aria-label="Hide MCP panel"
        onclick={hideMcp}
      >
        <Fa icon={faChevronRight}/>
      </button>
    </div>

    <div class="px-3 pt-3">
      <Input
        id="filter-tools"
        name="filter-tools"
        placeholder="Filter tools..."
        bind:value={searchTerm}
        aria-label="filter Tools">
      </Input>
    </div>

    <div class="flex-1 p-3 h-full">
      {#each $mcpRemoteServerInfos as mcp (mcp.id)}
        <McpFilterCard
          mcp={mcp}
          searchTerm={searchTerm}
          selectedTools={selectedMCPTools?.get(mcp.id)}
          onCheckMCP={onCheck.bind(undefined, mcp)}
          onCheckTool={onCheckMCPTool.bind(undefined, mcp.id)}
        />
      {/each}
    </div>
  </div>
{:else}
  <!-- Collapsed rail to reopen the panel on lg+ screens -->
  <div class="hidden lg:flex lg:flex-col lg:w-leftnavbar lg:min-w-leftnavbar border-l bg-background/50 h-full">
    <button
      class="text-xs text-muted-foreground hover:text-foreground whitespace-pre-line"
      title="Show MCP panel"
      aria-label="Show MCP panel"
      onclick={showMcp}
    >
      <div class="flex flex-col items-center justify-center">
        <Fa icon={faToolbox}/>
        <span class="text-xs text-center max-w-[60px] ml-[2px]">Tools</span>
      </div>
    </button>
  </div>
{/if}
