<script lang="ts">
import { untrack } from 'svelte';

import type { ModelInfo } from '/@/lib/chat/components/model-info';
import { agentDefinitions } from '/@/lib/guided-setup/agent-registry';
import { type CatalogModelInfo, getCatalogModels } from '/@/lib/models/models-utils';
import ModelSelectionTable from '/@/lib/models/ModelSelectionTable.svelte';
import { agentWorkspaceRuntime } from '/@/stores/agentworkspace-runtime';
import { disabledModels, isModelEnabled, modelKey } from '/@/stores/model-catalog';
import { providerInfos } from '/@/stores/providers';

interface Props {
  selectedAgent?: string;
  selectedModel?: ModelInfo;
}

let { selectedAgent = $bindable(''), selectedModel = $bindable() }: Props = $props();

let filteredAgents = $derived(agentDefinitions.filter(a => !a.runtimes || a.runtimes.includes($agentWorkspaceRuntime)));

let allModels: CatalogModelInfo[] = $derived.by(() => {
  const enabled = getCatalogModels($providerInfos).filter(m => isModelEnabled($disabledModels, m.providerId, m.label));
  const seen: Record<string, boolean> = {};
  return enabled.filter(m => {
    const key = modelKey(m.providerId, m.label);
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
});

let agentFilteredModels: CatalogModelInfo[] = $derived(filterByAgent(allModels, selectedAgent));

let selectedAgentLabel: string = $derived(
  agentDefinitions.find(a => a.cliName === selectedAgent)?.title ?? 'the selected agent',
);

let selectedKey: string = $derived(selectedModel ? modelKey(selectedModel.providerId, selectedModel.label) : '');

function filterByAgent(models: CatalogModelInfo[], agent: string): CatalogModelInfo[] {
  if (!agent) return models;
  const def = agentDefinitions.find(d => d.cliName === agent);
  if (!def?.modelFilter) return models;
  return models.filter(m => m.llmMetadata?.name === def.modelFilter);
}

function handleModelSelect(model: CatalogModelInfo): void {
  selectedModel = model;
}

function selectAgent(value: string): void {
  if (selectedAgent === value) return;
  selectedAgent = value;
}

$effect(() => {
  const models = agentFilteredModels;
  const current = untrack(() => selectedModel);
  if (current) {
    const stillEligible = models.some(
      m => modelKey(m.providerId, m.label) === modelKey(current.providerId, current.label),
    );
    if (stillEligible) return;
  }
  if (models.length > 0) {
    selectedModel = models[0];
  } else if (current) {
    selectedModel = undefined;
  }
});
</script>

<div class="flex flex-col gap-6">
  <!-- Agent selection -->
  <div>
    <h3 class="text-base font-semibold text-[var(--pd-modal-text)] mb-1">Choose your coding agent</h3>
    <p class="text-xs text-[var(--pd-content-card-text)] opacity-70 mb-3">
      Pick one runtime for <code class="text-[11px] bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded">kdn</code> in
      this workspace. API keys and providers are configured in Settings; the list below shows models that match the
      selected agent.
    </p>

    <div class="grid grid-cols-4 gap-3" role="listbox" aria-label="Coding agent">
      {#each filteredAgents as agent (agent.cliName)}
        {@const isSelected = selectedAgent === agent.cliName}
        <button
          type="button"
          role="option"
          aria-selected={isSelected}
          class="flex flex-col gap-3 p-4 rounded-xl border-2 cursor-pointer text-left transition-colors
            {isSelected
              ? 'border-[var(--pd-content-card-border-selected)] bg-[var(--pd-content-card-hover-inset-bg)]'
              : 'border-[var(--pd-content-card-border)] bg-[var(--pd-content-card-inset-bg)] hover:bg-[var(--pd-content-card-hover-inset-bg)]'}"
          onclick={(): void => selectAgent(agent.cliName)}>
          {#if agent.iconComponent}
            <agent.iconComponent size={44} />
          {/if}
          <span class="font-bold text-sm text-[var(--pd-modal-text)]">{agent.title}</span>
          <p class="text-xs text-[var(--pd-content-card-text)] opacity-70 leading-relaxed grow">
            {agent.description}
          </p>
          {#if agent.badge}
            <span class="self-start text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-[var(--pd-status-running)] text-[var(--pd-status-running)]">
              {agent.badge}
            </span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Model catalog -->
  {#if selectedAgent}
    <div>
      <h3 class="text-base font-semibold text-[var(--pd-modal-text)] mb-1">Model for workspace</h3>
      <p class="text-xs text-[var(--pd-content-card-text)] opacity-70 mb-3">
        Choose the default model <strong class="text-[var(--pd-modal-text)]">{selectedAgentLabel}</strong> will use
        here. Disabled rows cannot be selected; the table is filtered to models that fit the agent you picked above.
      </p>

      <ModelSelectionTable
        models={agentFilteredModels}
        selectedKey={selectedKey}
        onselect={handleModelSelect} />
    </div>
  {/if}
</div>
