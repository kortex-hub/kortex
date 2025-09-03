<script lang="ts">
import { Button, ErrorMessage, Input } from '@podman-desktop/ui-svelte';
// eslint-disable-next-line import/no-extraneous-dependencies
import { generate as generateWords } from 'random-words';
import { onMount } from 'svelte';

import MCPSelector from '/@/lib/chat/components/mcp-selector.svelte';
import ModelSelector from '/@/lib/chat/components/model-selector.svelte';
import { Textarea } from '/@/lib/chat/components/ui/textarea';
import { flowCreationStore } from '/@/lib/flows/flowCreationStore';
import { getModels } from '/@/lib/models/models-utils';
import FormPage from '/@/lib/ui/FormPage.svelte';
import { handleNavigation } from '/@/navigation';
import { hasInstalledFlowProviders } from '/@/stores/flow-providers';
import { providerInfos } from '/@/stores/providers';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';
import { NavigationPage } from '/@api/navigation-page';

import PlusIcon from '../chat/components/icons/plus.svelte';
import type { ModelInfo } from '../chat/components/model-info';
import FlowConnectionSelector from './components/flow-connection-selector.svelte';
import NoFlowProviders from './components/NoFlowProviders.svelte';

let selectedMCP = $state<MCPRemoteServerInfo[]>($flowCreationStore?.mcp ?? []);
let models: Array<ModelInfo> = $derived(getModels($providerInfos));
let selectedModel = $derived<ModelInfo | undefined>($flowCreationStore?.model ?? models[0]);

// error
let error: string | undefined = $state();
let loading: boolean = $state(false);

// form field
let name: string = $state(`flow-${generateWords({ exactly: 2, join: '-' })}`);
let description: string = $state('');
let instruction: string = $state('You are a helpful assistant.');
let prompt: string = $state($flowCreationStore?.prompt ?? '');
let flowProviderConnectionKey: string | undefined = $state<string>();
flowCreationStore.set(undefined);

let showFlowConnectionSelector = $state(true);

onMount(() => {
  try {
    const allFlowConnections = $providerInfos.flatMap(p =>
      (p.flowConnections ?? []).map(c => ({ providerId: p.id, connectionName: c.name })),
    );
    if (allFlowConnections.length === 1) {
      const only = allFlowConnections[0];
      flowProviderConnectionKey = `${only.providerId}:${only.connectionName}`;
      showFlowConnectionSelector = false;
    }
  } catch (e) {
    // ignore errors in auto-select logic to avoid blocking UI
    console.error('Flow auto-select skipped:', e);
  }
});

const formValidContent = $derived(
  !!flowProviderConnectionKey && !!selectedModel && !!name && !!prompt && !!instruction
    ? {
        flowProviderConnectionKey,
        model: {
          providerId: selectedModel.providerId,
          label: selectedModel.label,
        },
        name,
        description,
        mcp: $state.snapshot(selectedMCP),
        prompt,
        instruction,
      }
    : undefined,
);

async function generate(): Promise<void> {
  if (loading || !formValidContent) return;

  const { flowProviderConnectionKey } = formValidContent;

  loading = true;

  try {
    const [providerId, connectionName] = flowProviderConnectionKey.split(':');

    const flowId = await window.generateFlow(providerId, connectionName, formValidContent);

    handleNavigation({
      page: NavigationPage.FLOW_DETAILS,
      parameters: {
        flowId: flowId,
        providerId: providerId,
        connectionName: connectionName,
      },
    });
  } catch (err: unknown) {
    error = String(err);
  } finally {
    loading = false;
  }
}
</script>

<FormPage title="Flow Create" inProgress={loading}>
  {#snippet content()}
    <div class="px-5 pb-5 min-w-full">
    {#if $hasInstalledFlowProviders}
        <div class="bg-[var(--pd-content-card-bg)] px-6 py-4">
          <div class="flex flex-col">
            <div>You can create a flow using this form by selecting a model, one or several tools (from MCP servers)
              and specifying instructions.</div>
            <div>A flow can also be created by exporting a chat session. All information's on this page will then automatically be filled.</div>
            <div class="flex flex-row gap-1">The export feature in the chat window is available through the <PlusIcon size={14}/>icon</div>
          </div>
          {#if error}
            <ErrorMessage {error}/>
          {/if}

          <form
            novalidate
            class="p-2 space-y-7 h-fit"
          >
            <div>
              <span>Flow Name</span>
              <Input bind:value={name} placeholder="name" class="grow" required />
            </div>

            <!-- description -->
            <div>
              <span>Description</span>
              <Textarea
                placeholder="Description..."
                bind:value={description}
                class='bg-muted max-h-[calc(75dvh)] min-h-[24px] resize-none overflow-hidden rounded-2xl pb-10 !text-base dark:border-zinc-700'
                rows={2}
                autofocus
              />
            </div>
            <div class="flex flex-col">
              <span>Model</span>
                  <ModelSelector
                      class="order-1 md:order-2"
                      models={models}
                      bind:value={selectedModel}
                  />
            </div>

            <!-- tools -->
            <div class="flex flex-col">
              <span>Tools</span>
              <MCPSelector bind:selected={selectedMCP}/>
            </div>

            <!-- prompt -->
            <div>
              <span>Prompt</span>
              <Textarea
                placeholder="Prompt"
                bind:value={prompt}
                class='bg-muted max-h-[calc(75dvh)] min-h-[24px] resize-none overflow-hidden rounded-2xl pb-10 !text-base dark:border-zinc-700'
                rows={2}
                autofocus
              />
            </div>

            <!-- instruction -->
            <div>
              <span>Instruction</span>
              <Textarea
                placeholder="Instruction"
                bind:value={instruction}
                class='bg-muted max-h-[calc(75dvh)] min-h-[24px] resize-none overflow-hidden rounded-2xl pb-10 !text-base dark:border-zinc-700'
                rows={2}
                autofocus
              />
            </div>
            <div class="flex w-full">
              {#if showFlowConnectionSelector}
              <FlowConnectionSelector class="" bind:value={flowProviderConnectionKey}/>
              {/if}
              <Button class="ml-auto" inProgress={loading} disabled={!formValidContent} onclick={generate}>Generate</Button>
            </div>
          </form>
        </div>
    {:else}
      <NoFlowProviders />
    {/if}
    </div>
  {/snippet}
</FormPage>
