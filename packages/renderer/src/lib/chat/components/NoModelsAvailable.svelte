<script lang="ts">
import CreateProviderConnectionButton from '/@/lib/preferences/CreateProviderConnectionButton.svelte';
import ProviderInfoIcon from '/@/lib/preferences/ProviderInfoIcon.svelte';
import { providerInfos } from '/@/stores/providers';
</script>

<div class="flex flex-col items-center justify-center w-full p-8 gap-5 text-center bg-[var(--pd-content-bg)]">
  <h2 class="text-2xl font-semibold mb-4">No AI Models Available</h2>
  <p class="text-muted-foreground mb-6">You need to configure at least one AI model to start chatting.</p>

  {#each $providerInfos as providerInfo (providerInfo.id)}
    {#if providerInfo.inferenceProviderConnectionCreation}
      <div class="bg-[var(--pd-content-card-bg)] flex justify-between items-center gap-5 px-6 py-4 w-xs">
        <ProviderInfoIcon {providerInfo} />
        {providerInfo.name}
        <CreateProviderConnectionButton
          provider={providerInfo}
          providerDisplayName={providerInfo.inferenceProviderConnectionCreationDisplayName ?? providerInfo.name}
          buttonTitle="Connect" preflightChecks={[]}/>
      </div>
    {/if}
  {/each}
</div>
