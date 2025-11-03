<script lang="ts">
import type { Chat } from '@ai-sdk/svelte';
import type { SvelteMap } from 'svelte/reactivity';
import { fly } from 'svelte/transition';
import { toast } from 'svelte-sonner';

import { mcpRegistriesServerInfos } from '/@/stores/mcp-registry-servers';
import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';

import McpsToInstallToast from './McpsToInstallToast.svelte';
import { Button } from './ui/button';

let {
  chatClient,
  selectedMCPTools,
  mcpSelectorOpen = $bindable(),
}: {
  chatClient: Chat;
  selectedMCPTools: SvelteMap<string, Set<string>>;
  mcpSelectorOpen: boolean;
} = $props();

type SuggestedAction = {
  title: string;
  label: string;
  action: string;
  requiredMcp?: {
    mcpId: string;
    tools: Array<string>;
  }[];
};

const suggestedActions: SuggestedAction[] = [
  {
    title: 'What are the last 5 issues of GitHub',
    label: 'repository podman-desktop/podman-desktop?',
    action: 'What are the last 5 issues of GitHub repository podman-desktop/podman-desktop?',
    requiredMcp: [
      {
        mcpId: 'com.github.mcp',
        tools: ['list_issues'],
      },
    ],
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
  const mcpsToInstall = suggestedAction.requiredMcp?.flatMap(({ mcpId }) => {
    const mcpInstalledInfo = $mcpRemoteServerInfos.find(mcp => mcp.infos.serverId === mcpId);

    if (mcpInstalledInfo) {
      return [];
    }

    const mcpInfo = $mcpRegistriesServerInfos.find(mcp => mcp.serverId === mcpId);

    if (!mcpInfo) {
      throw Error(`Suggested action ${suggestedAction.action} requires MCP with id ${mcpId} but it was not found.`);
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

  const mcpsToSelect = (suggestedAction.requiredMcp ?? []).reduce(
    (acc, { mcpId, tools }) => {
      const server = $mcpRemoteServerInfos.find(mcp => mcp.infos.serverId === mcpId);

      if (server) {
        const selectedTools: Set<string> = selectedMCPTools.get(server.id) ?? new Set();
        const requiredTools: Set<string> = new Set(tools);

        if (requiredTools.isSubsetOf(selectedTools)) {
          return acc;
        }
      }

      const mcpInfo = $mcpRegistriesServerInfos.find(mcp => mcp.serverId === mcpId);

      if (!mcpInfo) {
        throw Error(`Suggested action ${suggestedAction.action} requires MCP with id ${mcpId} but it was not found.`);
      }

      acc.push([mcpInfo.name, tools]);
      return acc;
    },
    [] as Array<[string, string[]]>,
  );

  if (mcpsToSelect?.length) {
    const result = await window.showMessageBox({
      title: 'Select MCPs',
      message: `The following MCPs are required to use this suggested action: ${mcpsToSelect.join(', ')}. Do you want to select them?`,
      buttons: ['No', 'Yes'],
    });

    if (result?.response === 0) {
      // No
      mcpSelectorOpen = true;

      const builder = ['You need to select the following MCP:'];
      for (let [mcpName, tools] of mcpsToSelect) {
        const quoted = tools.map(tool => `'${tool}'`);
        builder.push(`- '${mcpName}' with tools ${quoted.join(',')}`);
      }

      toast.error(builder.join(' '));
      return;
    } else {
      // Yes
      for (let [mcpName, tools] of mcpsToSelect) {
        console.log('mcpName', mcpName);
        console.log('tools', tools);
        for (let tool of tools) {
          console.log('tool', tool);
          selectedMCPTools.get(mcpName)?.add(tool);
        }
      }
    }
  }

  await chatClient.sendMessage({
    role: 'user',
    parts: [{ text: suggestedAction.action, type: 'text' }],
  });
}
</script>

<div role="region" aria-label="Suggested prompts" class="grid w-full gap-2 sm:grid-cols-2">
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
