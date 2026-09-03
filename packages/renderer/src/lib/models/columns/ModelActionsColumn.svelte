<script lang="ts">
import type { CatalogModelInfo } from '/@/lib/models/models-utils';
import SlideToggle from '/@/lib/ui/SlideToggle.svelte';
import { disabledModels, isModelEnabled, toggleModel } from '/@/stores/model-catalog';

interface Props {
  object: CatalogModelInfo;
}

let { object }: Props = $props();

let toggleId: string = $derived(`model-toggle-${object.providerId}-${object.label}`.replace(/[^A-Za-z0-9_-]/g, '-'));
let enabled: boolean = $derived(isModelEnabled($disabledModels, object.providerId, object.label));

function onChecked(): void {
  toggleModel(object.providerId, object.label);
}
</script>

<SlideToggle
  id={toggleId}
  checked={enabled}
  on:checked={onChecked}
  aria-label={enabled ? `Disable ${object.label}` : `Enable ${object.label}`} />
