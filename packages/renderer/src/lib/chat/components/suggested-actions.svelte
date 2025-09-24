<script lang="ts">
import type { Chat } from '@ai-sdk/svelte';
import { fly } from 'svelte/transition';
import { toast } from 'svelte-sonner';

import { mcpRegistriesServerInfos } from '/@/stores/mcp-registry-servers';
import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';

import McpsToInstallToast from './McpsToInstallToast.svelte';
import { Button } from './ui/button';

let {
  chatClient,
  selectedMCP,
  mcpSelectorOpen = $bindable(),
}: {
  chatClient: Chat;
  selectedMCP: MCPRemoteServerInfo[];
  mcpSelectorOpen: boolean;
} = $props();

type SuggestedAction = {
  title: string;
  label: string;
  action: string;
  requiredMcp?: string[];
};

const suggestedActions: SuggestedAction[] = [
  {
    title: 'What are the last 5 issues of GitHub',
    label: 'repository podman-desktop/podman-desktop?',
    action: 'What are the last 5 issues of GitHub repository podman-desktop/podman-desktop?',
    requiredMcp: ['123e4567-e89b-12d3-a456-426614172000'],
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

async function onclick(suggestedAction: SuggestedAction): Promise<void> {
  const mcpsToInstall = suggestedAction.requiredMcp?.flatMap(id => {
    const mcpInstalledInfo = $mcpRemoteServerInfos.find(mcp => mcp.infos.serverId === id);

    if (mcpInstalledInfo) {
      return [];
    }

    const mcpInfo = $mcpRegistriesServerInfos.find(mcp => mcp.serverId === id);

    if (!mcpInfo) {
      throw Error(`Suggested action ${suggestedAction.action} requires MCP with id ${id} but it was not found.`);
    }

    return [mcpInfo];
  });

  if (mcpsToInstall?.length) {
    toast.error(McpsToInstallToast, {
      componentProps: {
        mcpsToInstall,
      },
    });
    return;
  }

  const mcpsToSelect = suggestedAction.requiredMcp?.flatMap(id => {
    const selected = selectedMCP.find(mcp => mcp.infos.serverId === id);

    if (selected) {
      return [];
    }
    const mcpInfo = $mcpRegistriesServerInfos.find(mcp => mcp.serverId === id);

    if (!mcpInfo) {
      throw Error(`Suggested action ${suggestedAction.action} requires MCP with id ${id} but it was not found.`);
    }

    return [mcpInfo.name];
  });

  if (mcpsToSelect?.length) {
    mcpSelectorOpen = true;

    toast.error(`You need to select the following MCP first: ${mcpsToSelect.join(', ')}`);
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
