<script lang="ts">
import { Button, Input } from '@podman-desktop/ui-svelte';

import Dialog from '/@/lib/dialogs/Dialog.svelte';
import type { FlowInfo } from '/@api/flow-info';

interface Props {
  flow: FlowInfo;
  onRun: (inputValues: Record<string, string>) => void;
  onCancel: () => void;
}

let { flow, onRun, onCancel }: Props = $props();

let inputValues = $state<Record<string, string>>(
  flow.parameters
    ? flow.parameters.reduce<Record<string, string>>((acc, param) => {
        acc[param.name] = param.default ?? '';
        return acc;
      }, {})
    : {},
);

const valid = $derived.by(() => {
  if (flow.parameters) {
    return flow.parameters.every(param => inputValues[param.name] && inputValues[param.name].trim() !== '');
  }
  return true;
});

function handleInputChange(paramName: string, event: Event): void {
  inputValues = {
    ...inputValues,
    [paramName]: (event.target as HTMLInputElement).value,
  };
}

function handleRun(): void {
  onRun(inputValues);
}
</script>

<Dialog
  title={`Run Flow: ${flow.name}`}
  onclose={onCancel}
>
  {#snippet content()}
    {#each flow.parameters ?? [] as param (param.name)}
      <div class="pb-4">
        <label for={`param-${param.name}`}>
          {param.name}
        </label>
        {#if param.description}
          <p class="text-sm mb-1">{param.description}</p>
        {/if}
        <Input
          id={`param-${param.name}`}
          value={inputValues[param.name]}
          oninput={(e): void => handleInputChange(param.name, e)}
        />
      </div>
    {/each}
  {/snippet}

  {#snippet buttons()}
    <div class="flex justify-end space-x-2 p-4">
      <Button onclick={onCancel}>Cancel</Button>
      <Button onclick={handleRun} disabled={!valid}>Run</Button>
    </div>
  {/snippet}
</Dialog>
