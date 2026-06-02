<script lang="ts">
import { faTerminal } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';

import IconImage from '/@/lib/appearance/IconImage.svelte';
import type { CatalogModelInfo, InferenceConnectionSummary } from '/@/lib/models/models-utils';
import ModelSelectionTable from '/@/lib/models/ModelSelectionTable.svelte';
import ProviderConnectionTiles from '/@/lib/models/ProviderConnectionTiles.svelte';
import { inferenceConnectionSummariesData } from '/@/stores/inference-connection-summaries';
import { modelKey } from '/@/stores/model-catalog';
import { catalogModels } from '/@/stores/models';
import type { AgentInfo } from '/@api/agent-info';
import type { DefaultPerAgentWorkspaceSettings, DefaultWorkspaceSettings } from '/@api/onboarding-settings-info';

interface Props {
  agentInfo: AgentInfo;
}

let { agentInfo }: Props = $props();

let compatibleModels: CatalogModelInfo[] = $derived.by(() => {
  const types = agentInfo.supportedModelTypes;
  if (types === undefined) return $catalogModels.slice();
  if (types.length === 0) return [];
  const typeNames = new Set(types.map(t => t.name));
  return $catalogModels.filter(m => m.llmMetadata?.name !== undefined && typeNames.has(m.llmMetadata.name));
});

let hasModels = $derived(compatibleModels.length > 0);

let configurableConnections: InferenceConnectionSummary[] = $derived.by(() => {
  const all: InferenceConnectionSummary[] = $inferenceConnectionSummariesData.slice();
  if (agentInfo.supportedModelTypes === undefined) return all;
  const compatibleProviderIds = new Set(compatibleModels.map(m => m.providerId));
  if (compatibleProviderIds.size === 0) return all;
  return all.filter(c => compatibleProviderIds.has(c.providerId));
});

let savedModelKey = $state('');
let selectedModelKey = $state('');
let saving = $state(false);

let hasChanges = $derived(selectedModelKey !== '' && selectedModelKey !== savedModelKey);
let selectedModel: CatalogModelInfo | undefined = $derived(
  compatibleModels.find(m => modelKey(m.providerId, m.label) === selectedModelKey),
);

async function loadSavedModel(): Promise<void> {
  try {
    const existing = await window.getConfigurationValue<DefaultWorkspaceSettings>(
      'onboarding.defaultWorkspaceSettings',
    );
    const agentSettings = existing?.defaultAgentSettings?.[agentInfo.id];
    if (agentSettings?.defaultModel) {
      const key = modelKey(agentSettings.defaultModel.providerId, agentSettings.defaultModel.label);
      savedModelKey = key;
      selectedModelKey = key;
    }
  } catch {
    // ignore — no saved model
  }
}

$effect(() => {
  loadSavedModel().catch(() => {});
});

function selectModel(model: CatalogModelInfo): void {
  selectedModelKey = modelKey(model.providerId, model.label);
}

function discardChanges(): void {
  selectedModelKey = savedModelKey;
}

async function saveSelection(): Promise<void> {
  if (!selectedModel) return;
  saving = true;
  try {
    const existing = await window.getConfigurationValue<DefaultWorkspaceSettings>(
      'onboarding.defaultWorkspaceSettings',
    );
    const settings: DefaultWorkspaceSettings = existing ?? {};
    settings.defaultAgentSettings ??= {};

    const agentSettings: DefaultPerAgentWorkspaceSettings = settings.defaultAgentSettings[agentInfo.id] ?? {};
    agentSettings.defaultModel = {
      providerId: selectedModel.providerId,
      connectionName: selectedModel.connectionName,
      label: selectedModel.label,
    };
    settings.defaultAgentSettings[agentInfo.id] = agentSettings;

    await window.updateConfigurationValue('onboarding.defaultWorkspaceSettings', settings);
    savedModelKey = selectedModelKey;
  } catch (err: unknown) {
    console.error('Failed to save agent model selection', err);
    await window.showMessageBox({
      title: 'Coding agents',
      type: 'error',
      message: `Failed to save default model: ${err instanceof Error ? err.message : String(err)}`,
      buttons: ['OK'],
    });
  } finally {
    saving = false;
  }
}

function getAgentSubtitle(agent: AgentInfo): string {
  return agent.tags?.join(' · ') ?? '';
}
</script>

<div class="flex flex-col h-full overflow-y-auto">
  <div class="pt-6 px-8">
    <div class="flex items-center gap-3 mb-1">
      <IconImage image={agentInfo.icon?.logo ?? agentInfo.icon?.icon} alt={agentInfo.name} class="w-8 h-8">
        <Icon icon={faTerminal} size="2x" />
      </IconImage>
      <h1 class="text-2xl font-bold text-(--pd-content-header)">{agentInfo.name}</h1>
    </div>
    {#if getAgentSubtitle(agentInfo)}
      <p class="text-sm text-(--pd-link) mb-2">{getAgentSubtitle(agentInfo)}</p>
    {/if}
    {#if agentInfo.description}
      <p class="text-sm text-(--pd-content-text) opacity-70 mb-6">{agentInfo.description}</p>
    {/if}
  </div>

  <div class="px-8 pb-8 flex-1">
    {#if configurableConnections.length > 0}
      <div class="mb-4">
        <ProviderConnectionTiles connections={configurableConnections} />
      </div>
    {/if}

    {#if hasModels}
      <div class="rounded-xl border border-(--pd-content-card-border) bg-(--pd-content-card-inset-bg) p-6">
        <h2 class="text-sm font-semibold text-(--pd-content-card-text) mb-1">Default model</h2>
        <p class="text-xs text-(--pd-content-card-text) opacity-60 mb-4">
          Select the default model for this agent. You can override per workspace later.
        </p>
        <ModelSelectionTable
          models={compatibleModels}
          selectedKey={selectedModelKey}
          onselect={selectModel} />

        <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-(--pd-content-divider)">
          <span class="text-xs text-(--pd-content-card-text) opacity-60 mr-auto">
            {hasChanges ? 'You have unsaved changes' : ''}
          </span>
          <Button type="secondary" onclick={discardChanges} disabled={!hasChanges}>Discard</Button>
          <Button onclick={saveSelection} disabled={!hasChanges || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    {:else if configurableConnections.length === 0}
      <div class="rounded-xl border border-(--pd-content-card-border) bg-(--pd-content-card-inset-bg) p-6">
        <div class="flex flex-col items-center text-center py-6">
          <Icon icon={faTerminal} size="2em" class="text-(--pd-content-card-text) opacity-40 mb-4" />
          <h2 class="text-base font-semibold text-(--pd-content-card-text) mb-2">No models or providers available</h2>
          <p class="text-sm text-(--pd-content-card-text) opacity-60 max-w-md">
            Install a compatible provider extension, then return here to select a model.
          </p>
        </div>
      </div>
    {:else}
      <div class="rounded-xl border border-(--pd-content-card-border) bg-(--pd-content-card-inset-bg) p-6">
        <div class="flex flex-col items-center text-center py-6">
          <Icon icon={faTerminal} size="2em" class="text-(--pd-content-card-text) opacity-40 mb-4" />
          <h2 class="text-base font-semibold text-(--pd-content-card-text) mb-2">No compatible models found</h2>
          <p class="text-sm text-(--pd-content-card-text) opacity-60 max-w-md">
            Your providers are connected but no compatible models are available yet.
            Check the provider settings above or install a model that supports this agent.
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>
