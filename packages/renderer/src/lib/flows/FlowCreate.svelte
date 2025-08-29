<script lang="ts">
import { Button, ErrorMessage, Input } from '@podman-desktop/ui-svelte';
import { SvelteSet } from 'svelte/reactivity';

import MCPSelector from '/@/lib/chat/components/mcp-selector.svelte';
import ModelSelector from '/@/lib/chat/components/model-selector.svelte';
import { Textarea } from '/@/lib/chat/components/ui/textarea';
import { flowCreationStore } from '/@/lib/flows/flowCreationStore';
import { getModels } from '/@/lib/models/models-utils';
import FormPage from '/@/lib/ui/FormPage.svelte';
import { handleNavigation } from '/@/navigation';
import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';
import { providerInfos } from '/@/stores/providers';
import { NavigationPage } from '/@api/navigation-page';

import type { ModelInfo } from '../chat/components/model-info';
import FlowConnectionSelector from './components/flow-connection-selector.svelte';
import NoFlowProviders from './components/NoFlowProviders.svelte';

let selectedMCP = $state<Set<string>>($flowCreationStore?.mcp ?? new SvelteSet());
let models: Array<ModelInfo> = $derived(getModels($providerInfos));
let selectedModel = $state<ModelInfo | undefined>($flowCreationStore?.model);

// error
let error: string | undefined = $state();
let loading: boolean = $state(false);

// form field
let name: string = $state('');
let description: string = $state('');
let instruction: string = $state($flowCreationStore?.prompt ?? '');
let prompt: string = $state('You are a helpful assistant.');
let flowProviderConnectionKey: string | undefined = $state<string>();
flowCreationStore.set(undefined);

let hasInstalledFlowProviders = $state(window.hasInstalledFlowProviders());

function retryCheck(): void {
  hasInstalledFlowProviders = window.hasInstalledFlowProviders();
}

async function generate(): Promise<void> {
  if (!flowProviderConnectionKey) return;
  if (loading) return;

  loading = true;

  try {
    const [providerId, connectionName] = flowProviderConnectionKey.split(':');

    const flowId = await window.generateFlow(providerId, connectionName, {
      name: $state.snapshot(name),
      description: $state.snapshot(description),
      instruction: $state.snapshot(instruction),
      prompt: $state.snapshot(prompt),
      mcp: [...selectedMCP].map(m => ({
        name: m,
        type: 'streamable_http',
        uri: $mcpRemoteServerInfos.find(mcp => mcp.id === m)!.url,
      })),
    });

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
    {#await hasInstalledFlowProviders then hasInstalledFlowProvidersC}
      <div class="px-5 pb-5 min-w-full">
      {#if hasInstalledFlowProvidersC}
          <div class="bg-[var(--pd-content-card-bg)] px-6 py-4">
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
                <span>Prompt (System prompt)</span>
                <Textarea
                  placeholder="Prompt"
                  bind:value={prompt}
                  class='bg-muted max-h-[calc(75dvh)] min-h-[24px] resize-none overflow-hidden rounded-2xl pb-10 !text-base dark:border-zinc-700'
                  rows={2}
                  autofocus
                />
              </div>

              <!-- system prompt -->
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

              <FlowConnectionSelector class="" bind:value={flowProviderConnectionKey}/>
              <Button inProgress={loading} disabled={!flowProviderConnectionKey} onclick={generate}>Generate</Button>
            </form>
          </div>
      {:else}
        <NoFlowProviders {retryCheck} />
      {/if}
      </div>
    {/await}
  {/snippet}
</FormPage>
