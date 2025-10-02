<script lang="ts">
import type { Chat } from '@ai-sdk/svelte';
// eslint-disable-next-line import/no-duplicates
import { get } from 'svelte/store';
// eslint-disable-next-line import/no-duplicates
import { fly } from 'svelte/transition';
import { toast } from 'svelte-sonner';

import McpsToInstallToast from '/@/lib/chat/components/McpsToInstallToast.svelte';
import type { SuggestedMCP } from '/@/lib/chat/components/suggested-mcp';
import { mcpConfigsInfo } from '/@/stores/mcp-configs-info';
import type { MCPConfigInfo } from '/@api/mcp/mcp-config-info';

import { Button } from './ui/button';

interface Props {
  chatClient: Chat;
  selectedMCP: MCPConfigInfo[];
  mcpSelectorOpen: boolean;
}

let { chatClient, selectedMCP, mcpSelectorOpen = $bindable() }: Props = $props();

type SuggestedAction = {
  title: string;
  label: string;
  action: string;
  requiredMcp?: Array<SuggestedMCP>;
};

const GITHUB_MCP: SuggestedMCP = {
  serverName: 'com.github.mcp',
  registryURL: 'https://kortex-hub.github.io/mcp-registry-online/v1.2.3/',
};

const suggestedActions: SuggestedAction[] = [
  {
    title: 'What are the last 5 issues of GitHub',
    label: 'repository podman-desktop/podman-desktop?',
    action: 'What are the last 5 issues of GitHub repository podman-desktop/podman-desktop?',
    requiredMcp: [GITHUB_MCP],
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

function isSelected(suggested: SuggestedMCP): boolean {
  return selectedMCP.some(
    selected => selected.name === suggested.serverName && selected.registryURL === suggested.registryURL,
  );
}

function hasConfig(suggested: SuggestedMCP): boolean {
  return get(mcpConfigsInfo).some(
    config => config.name === suggested.serverName && config.registryURL === suggested.registryURL,
  );
}

async function onclick(suggestedAction: SuggestedAction): Promise<void> {
  // 1. found MCP that need to be installed
  const mpcToInstall = (suggestedAction.requiredMcp ?? []).filter(suggested => !hasConfig(suggested));
  if (mpcToInstall.length > 0) {
    toast.error(McpsToInstallToast, {
      componentProps: {
        mcpsToInstall: mpcToInstall,
      },
    });
    return;
  }

  // 2. found MCP that need to be selected
  const mpcsToSelect = (suggestedAction.requiredMcp ?? []).filter(suggested => !isSelected(suggested));
  if (mpcsToSelect?.length) {
    mcpSelectorOpen = true;

    toast.error(
      `You need to select the following MCP first: ${mpcsToSelect.map(suggested => suggested.name).join(', ')}`,
    );
    return;
  }

  await chatClient.sendMessage({
    role: 'user',
    parts: [{ text: suggestedAction.action, type: 'text' }],
  });
}
</script>

<div class="grid w-full gap-2 sm:grid-cols-2">
	{#each suggestedActions as suggestedAction, i (suggestedAction.title)}
		<div
			in:fly|global={{ opacity: 0, y: 20, delay: 50 * i, duration: 400 }}
			class={i > 1 ? 'hidden sm:block' : 'block'}
		>
			<Button
				variant="ghost"
				onclick={onclick.bind(undefined, suggestedAction)}
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
