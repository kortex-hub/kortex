<script lang="ts">
import CreateProviderConnectionButton from '/@/lib/preferences/CreateProviderConnectionButton.svelte';
import ProviderInfoIcon from '/@/lib/preferences/ProviderInfoIcon.svelte';
import { providerInfos } from '/@/stores/providers';
</script>

<div class="flex flex-col items-center justify-center w-full p-8 gap-5 text-center bg-[var(--pd-content-bg)]">
  <h2 class="text-2xl font-semibold mb-4">No AI Models Available</h2>
  <p class="text-muted-foreground mb-6">You need to configure at least one AI model to start chatting.</p>

  <div class="flex flex-col gap-5 max-w-lg">
    {#each $providerInfos as providerInfo (providerInfo.id)}
      {#if providerInfo.inferenceProviderConnectionCreation}
        <div class="bg-[var(--pd-content-card-bg)] flex justify-between items-center gap-5 px-6 py-4">
          <div class="flex items-center gap-3 text-left min-w-0">
            <div class="w-10 h-10 flex items-center justify-center shrink-0 [&>img]:max-w-full [&>img]:max-h-full [&>img]:object-contain">
              <ProviderInfoIcon {providerInfo} />
            </div>
            <span class="text-base font-medium truncate">{providerInfo.name}</span>
          </div>
          <div class="shrink-0">
            <CreateProviderConnectionButton
              provider={providerInfo}
              providerDisplayName={providerInfo.inferenceProviderConnectionCreationDisplayName ?? providerInfo.name}
              buttonTitle="Connect" preflightChecks={[]}/>
          </div>
        </div>
      {/if}
    {/each}
  </div>
</div>
