<script lang="ts">
import { Button } from '@podman-desktop/ui-svelte';
import { toast } from 'svelte-sonner';
import { router } from 'tinro';

import CreateProviderConnectionButton from '/@/lib/preferences/CreateProviderConnectionButton.svelte';
import ProviderInfoIcon from '/@/lib/preferences/ProviderInfoIcon.svelte';
import { providerInfos } from '/@/stores/providers';

let isClearing = $state(false);

async function clearAllConnections(): Promise<void> {
  isClearing = true;
  try {
    toast.info('Clearing all connections...');
    setTimeout(() => window.location.reload(), 1000);
  } catch (error) {
    toast.error('Failed to clear connections');
  } finally {
    isClearing = false;
  }
}

// Auto-enable OpenAI extension when needed
async function ensureOpenAIEnabled(): Promise<void> {
  const openaiProvider = $providerInfos.find(provider => provider.id === 'openai');
  if (!openaiProvider) {
    toast.info('Enabling OpenAI extension...');
    await window.ensureExtensionIsEnabled('kortex.openai');
    await window.startExtension('kortex.openai');
  }
}
</script>

<div class="flex flex-col items-center justify-center w-full p-8 gap-5 text-center bg-[var(--pd-content-bg)]">
  <h2 class="text-2xl font-semibold mb-4">No AI Models Available</h2>
  <p class="text-muted-foreground mb-6">You need to configure at least one AI model to start chatting.</p>

  <!-- Clear connections button if needed -->
  {#if $providerInfos.some(p => p.inferenceConnections.length > 0)}
    <div class="bg-[var(--pd-content-card-bg)] p-4 rounded-lg max-w-md">
      <Button
        onclick={clearAllConnections}
        disabled={isClearing}
        inProgress={isClearing}
        class="w-full"
      >
        {isClearing ? 'Clearing...' : 'Clear All Connections'}
      </Button>
    </div>
  {/if}

  <!-- Existing Provider Connections -->
  {#each $providerInfos as providerInfo (providerInfo.id)}
    {#if providerInfo.inferenceProviderConnectionCreation}
      <div class="bg-[var(--pd-content-card-bg)] flex justify-between items-center gap-5 px-6 py-4 w-xs">
        <ProviderInfoIcon {providerInfo} />
        {providerInfo.name}
        {#if providerInfo.id === 'openai'}
          <Button
            onclick={async (): Promise<void> => {
              await ensureOpenAIEnabled();
              await window.telemetryTrack('createNewProviderConnectionPageRequested', {
                providerId: providerInfo.id,
                name: providerInfo.name,
              });
              // Pre-populate with defaults by passing URL parameters
              router.goto(`/preferences/provider/${providerInfo.internalId}?baseURL=http://localhost:8080/v1&apiKey=dummy-key`);
            }}
          >
            Connect
          </Button>
        {:else}
          <CreateProviderConnectionButton
            provider={providerInfo}
            providerDisplayName={providerInfo.inferenceProviderConnectionCreationDisplayName ?? providerInfo.name}
            buttonTitle="Connect" preflightChecks={[]}/>
        {/if}
      </div>
    {/if}
  {/each}
</div>
