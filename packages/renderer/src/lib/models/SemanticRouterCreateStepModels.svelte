<script lang="ts">
import { SvelteSet } from 'svelte/reactivity';

import { disabledModels, isModelEnabled, modelKey, modelSelectionKey } from '/@/stores/model-catalog';
import { catalogModels } from '/@/stores/models';

import type { CatalogModelInfo } from './models-utils';
import ModelSelectionTable from './ModelSelectionTable.svelte';

interface Props {
  selectedModels?: CatalogModelInfo[];
}

let { selectedModels = $bindable([]) }: Props = $props();

let selectedKeys = new SvelteSet<string>(
  selectedModels.map(m => modelSelectionKey(m.providerId, m.connectionId, m.label)),
);

let eligibleModels: CatalogModelInfo[] = $derived.by(() => {
  const enabled = $catalogModels.filter(m => isModelEnabled($disabledModels, m.providerId, m.label));
  const seen: Record<string, boolean> = {};
  return enabled.filter(m => {
    if (m.llmMetadata?.semanticRouter !== undefined) return false;
    const key = modelKey(m.providerId, m.label);
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
});

$effect(() => {
  selectedModels = eligibleModels.filter(m =>
    selectedKeys.has(modelSelectionKey(m.providerId, m.connectionId, m.label)),
  );
});

function toggleModel(model: CatalogModelInfo): void {
  const key = modelSelectionKey(model.providerId, model.connectionId, model.label);
  if (selectedKeys.has(key)) {
    selectedKeys.delete(key);
  } else {
    selectedKeys.add(key);
  }
}
</script>

<div>
  <h2 class="text-lg font-semibold text-(--pd-modal-text) mb-1">Backend models</h2>
  <p class="text-sm text-(--pd-content-card-text) opacity-60 mb-5">
    Select one or more models the router can forward requests to. Models that are themselves
    semantic routers are excluded automatically.
  </p>

  <ModelSelectionTable
    models={eligibleModels}
    multiSelect={true}
    selectedKeys={selectedKeys}
    ontoggle={toggleModel} />
</div>
