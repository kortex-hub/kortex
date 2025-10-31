<script lang="ts">
import { faBook } from '@fortawesome/free-solid-svg-icons/faBook';
import Fa from 'svelte-fa';

import { cn } from '/@/lib/chat/utils/shadcn';
import { ragEnvironments } from '/@/stores/rag-environments';
import type { RagEnvironment } from '/@api/rag/rag-environment';

import CheckCircleFillIcon from './icons/check-circle-fill.svelte';
import ChevronDownIcon from './icons/chevron-down.svelte';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface Props {
  class?: string;
  disabled?: boolean;
  open?: boolean;
  onSelect: (env: RagEnvironment | undefined) => void;
}

let { class: className, disabled = false, open = $bindable(false), onSelect }: Props = $props();

// Filter RAG environments to only show those with an MCP server
const ragEnvironmentsWithMCP = $derived($ragEnvironments.filter(env => env.mcpServer !== undefined));

let selected = $state<RagEnvironment | undefined>(undefined);

const selectedText = $derived(selected?.name ?? 'No Knowledge Base');

function onSelectRagEnvironment(env: RagEnvironment | undefined, event: Event): void {
  event.preventDefault(); // prevent dropdown from closing itself
  onSelect(env);
  selected = env;
  open = false; // close the dropdown after selection
}
</script>

<DropdownMenu {open} onOpenChange={(val): boolean => (open = val)}>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button
        {...props}
        aria-label="Select knowledge base"
        variant="outline"
        {disabled}
        class={cn('data-[state=open]:bg-accent data-[state=open]:text-accent-foreground w-fit md:h-[34px] md:px-2', className)}
      >
        <Fa icon={faBook} />
        {selectedText}
        <ChevronDownIcon />
      </Button>
    {/snippet}
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start" class="min-w-[300px]">
    <DropdownMenuLabel>
      <div class="flex flex-col gap-1">
        <div class="font-semibold">Select Knowledge Base</div>
        <div class="text-xs font-normal text-muted-foreground">Choose a knowledge environment to enhance your chat</div>
      </div>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />

    {#if ragEnvironmentsWithMCP.length === 0}
      <DropdownMenuItem
        disabled
        class="group/item flex flex-row items-center justify-between gap-4"
      >
        No RAG environments with MCP available
      </DropdownMenuItem>
    {:else}
      <DropdownMenuGroup>
        <!-- No Knowledge Base option -->
        <DropdownMenuItem
          onSelect={onSelectRagEnvironment.bind(undefined, undefined)}
          class="group/item flex flex-row items-center justify-between gap-4"
          data-active={selected === undefined}
        >
          <div class="flex flex-col items-start gap-1">
            <div class="font-medium">No Knowledge Base</div>
            <div class="text-xs text-muted-foreground">Chat without RAG enhancement</div>
          </div>

          <div
            class="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100"
          >
            <CheckCircleFillIcon />
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <!-- RAG Environment options -->
        {#each ragEnvironmentsWithMCP as ragEnv (ragEnv.name)}
          <DropdownMenuItem
            onSelect={onSelectRagEnvironment.bind(undefined, ragEnv)}
            class="group/item flex flex-row items-center justify-between gap-4"
            data-active={selected?.name === ragEnv.name}
          >
            <div class="flex flex-col items-start gap-1">
              <div class="font-medium">{ragEnv.name}</div>
              <div class="text-xs text-muted-foreground">
                {ragEnv.ragConnection.providerId} • {ragEnv.indexedFiles.length} sources
              </div>
            </div>

            <div
              class="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100"
            >
              <CheckCircleFillIcon />
            </div>
          </DropdownMenuItem>
        {/each}
      </DropdownMenuGroup>
    {/if}
  </DropdownMenuContent>
</DropdownMenu>
