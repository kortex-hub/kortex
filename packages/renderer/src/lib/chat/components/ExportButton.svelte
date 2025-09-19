<script lang="ts">
import { type Chat } from '@ai-sdk/svelte';
import { toast } from 'svelte-sonner';

import { flowCreationStore } from '/@/lib/flows/flowCreationStore';
import { handleNavigation } from '/@/navigation';
import { isFlowConnectionAvailable } from '/@/stores/flow-provider';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';
import { NavigationPage } from '/@api/navigation-page';

import ExportIcon from './messages/ExportIcon.svelte';
import type { ModelInfo } from './model-info';
import { Button } from './ui/button';

let {
  selectedModel,
  selectedMCP,
  loading,
  chatClient,
}: {
  selectedModel?: ModelInfo;
  selectedMCP: MCPRemoteServerInfo[];
  loading: boolean;
  chatClient: Chat;
} = $props();

let loadingExportAsFlow = $state(false);

const exportAsFlow = async (): Promise<void> => {
  if (!selectedModel) {
    toast.error(`There's no selected model to export as a flow.`);
    return;
  }

  loadingExportAsFlow = true;

  try {
    const { providerId, connectionName, label } = selectedModel;
    const prompt = await window.inferenceGenerate({
      providerId,
      connectionName,
      modelId: label,
      mcp: selectedMCP.map(m => m.id),
      messages: $state.snapshot(chatClient.messages).concat([
        {
          id: crypto.randomUUID(),
          role: 'user',
          parts: [
            {
              text: 'Use the conversation to make a unique prompt, only return the prompt it will be executed automatically.',
              type: 'text',
            },
          ],
        },
      ]),
    });

    flowCreationStore.set({
      prompt,
      model: selectedModel,
      mcp: selectedMCP,
    });

    handleNavigation({ page: NavigationPage.FLOW_CREATE });
  } catch (e) {
    console.error(e);
  } finally {
    loadingExportAsFlow = false;
  }
};
</script>

<Button
	class="h-fit rounded-md p-[7px] hover:bg-zinc-200 dark:border-zinc-700 hover:dark:bg-zinc-900"
	onclick={async(event): Promise<void> => {
		event.preventDefault();
		await exportAsFlow();
	}}
	disabled={loading || !chatClient.messages.length || loadingExportAsFlow}
	variant="ghost"
	title={$isFlowConnectionAvailable? 'Export as Flow' : 'Install flow provider to enable save.'}
>
	<ExportIcon size="2x"/>
</Button>
