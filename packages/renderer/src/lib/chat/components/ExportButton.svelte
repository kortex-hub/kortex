<script lang="ts">
import { type Chat } from '@ai-sdk/svelte';
import { toast } from 'svelte-sonner';

import { flowCreationData } from '/@/lib/chat/state/flow-creation-data.svelte';
import { handleNavigation } from '/@/navigation';
import { isFlowConnectionAvailable } from '/@/stores/flow-provider';
import { NavigationPage } from '/@api/navigation-page';

import FlowIcon from '../../images/FlowIcon.svelte';
import type { ModelInfo } from './model-info';
import { Button } from './ui/button';

let {
  selectedModel,
  selectedMCP,
  selectedMCPTools,
  loading,
  chatClient,
}: {
  selectedModel?: ModelInfo;
  selectedMCP: MCPRemoteServerInfo[];
  selectedMCPTools?: Map<string, Set<string>>;
  loading: boolean;
  chatClient: Chat;
} = $props();

let loadingExportAsFlow = $state(false);

let title = $derived($isFlowConnectionAvailable ? 'Export as Flow' : 'Install flow provider to enable save.');

const exportAsFlow = async (): Promise<void> => {
  if (!selectedModel) {
    toast.error(`There's no selected model to export as a flow.`);
    return;
  }

  loadingExportAsFlow = true;

  try {
    const { providerId, connectionName, label } = selectedModel;

    const tools: Record<string, string[]> = Object.fromEntries(
      selectedMCPTools.entries().reduce(
        (accumulator, [mcpId, tools]) => {
          if (tools.size > 0) {
            accumulator.push([mcpId, Array.from(tools.values())]);
          }
          return accumulator;
        },
        [] as Array<[string, string[]]>,
      ),
    );

    const generatedFlowParams = await window.inferenceGenerateFlowParams({
      providerId,
      connectionName,
      modelId: label,
      tools: Object.fromEntries(
        selectedMCPTools?.entries()?.map(([toolName, value]) => [toolName, Array.from(value.values())]) ?? [],
      ),
      mcp: selectedMCP.map(m => m.id),
      messages: $state.snapshot(chatClient.messages),
    });

    flowCreationData.value = {
      ...generatedFlowParams,
      model: selectedModel,
      tools: tools,
    };

    handleNavigation({ page: NavigationPage.FLOW_CREATE });
  } catch (e) {
    console.error(e);
  } finally {
    loadingExportAsFlow = false;
  }
};
</script>

<Button
	class="h-fit rounded-2xl p-[5px] mr-1 border"
	onclick={async(event): Promise<void> => {
		event.preventDefault();
		await exportAsFlow();
	}}
	disabled={loading || !chatClient.messages.length || loadingExportAsFlow}
	variant="outline"
	{title}
>
  <FlowIcon size={2}/>
  {title}
</Button>
