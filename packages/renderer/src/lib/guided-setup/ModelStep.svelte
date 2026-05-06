
<script lang="ts">
import { untrack } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

import { agentDefinitions } from '/@/lib/guided-setup/agent-registry';
import type { CatalogModelInfo } from '/@/lib/models/models-utils';
import { getCatalogModels } from '/@/lib/models/models-utils';
import ModelSelectionTable from '/@/lib/models/ModelSelectionTable.svelte';
import { disabledModels, isModelEnabled, modelKey } from '/@/stores/model-catalog';
import { providerInfos } from '/@/stores/providers';
import type { DefaultWorkspaceModelSettings } from '/@api/onboarding-settings-info';

import type { GuidedSetupStepProps } from './guided-setup-steps';

let { onboarding }: GuidedSetupStepProps = $props();

let userSelectionKey = $state(
  untrack(() => (onboarding.model ? modelKey(onboarding.model.providerId, onboarding.model.label) : '')),
);

let agentDef = $derived(agentDefinitions.find(d => d.cliName === onboarding.agent));
let selectedAgentLabel = $derived(agentDef?.title ?? 'the selected agent');

let allModels: CatalogModelInfo[] = $derived.by(() => {
  const enabled = getCatalogModels($providerInfos).filter(m => isModelEnabled($disabledModels, m.providerId, m.label));
  const seen = new SvelteSet<string>();
  return enabled.filter(m => {
    const key = modelKey(m.providerId, m.label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

let agentFilteredModels: CatalogModelInfo[] = $derived.by(() => {
  if (!agentDef?.modelFilter) return allModels;
  return allModels.filter(m => m.llmMetadata?.name === agentDef!.modelFilter);
});

let effectiveModel: CatalogModelInfo | undefined = $derived.by(() => {
  if (userSelectionKey) {
    const match = agentFilteredModels.find(m => modelKey(m.providerId, m.label) === userSelectionKey);
    if (match) return match;
  }
  return agentFilteredModels.length > 0 ? agentFilteredModels[0] : undefined;
});

$effect(() => {
  if (agentFilteredModels.length === 0) return;
  if (effectiveModel) {
    const sel: DefaultWorkspaceModelSettings = {
      providerId: effectiveModel.providerId,
      connectionName: effectiveModel.connectionName,
      label: effectiveModel.label,
    };
    onboarding.model = sel;
  } else {
    onboarding.model = undefined;
  }
});

function selectModel(model: CatalogModelInfo): void {
  userSelectionKey = modelKey(model.providerId, model.label);
}
</script>

<div class="mx-auto max-w-3xl py-4">
  <h2 class="text-xl font-semibold text-(--pd-content-card-text) mb-1">Default model for the agent</h2>
  <p class="text-sm text-(--pd-content-card-text) opacity-60 mb-6">
    This is the model used by default in new workspaces.
    Names match the <strong class="text-(--pd-modal-text)">Models</strong> catalog; enable or disable rows there.
    You can override per session later.
  </p>

  <div class="rounded-xl border border-(--pd-content-card-border) bg-(--pd-content-card-inset-bg) p-6">
    <p class="text-xs text-(--pd-content-card-text) opacity-70 mb-4">
      {#if agentDef?.modelFilter}
        Cloud catalog on <strong class="text-(--pd-modal-text)">Models</strong> — {selectedAgentLabel} rows (enabled). Click a row to choose.
      {:else}
        Same rows as <strong class="text-(--pd-modal-text)">Models</strong>. Click a line or use the <strong class="text-(--pd-modal-text)">Use</strong> control to pick your default for <strong class="text-(--pd-modal-text)">local</strong> models.
      {/if}
    </p>

    <ModelSelectionTable
      models={agentFilteredModels}
      selectedKey={effectiveModel ? modelKey(effectiveModel.providerId, effectiveModel.label) : ''}
      showCatalogLink={false}
      onselect={selectModel} />
  </div>
</div>
