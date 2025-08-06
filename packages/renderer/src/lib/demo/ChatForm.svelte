<script lang="ts">
import { Button, ErrorMessage } from '@podman-desktop/ui-svelte';

import Markdown from '/@/lib/markdown/Markdown.svelte';
import { providerInfos } from '/@/stores/providers';

let model = $state<string>('');
let prompt = $state<string>('');

/**
 * Selecting provider
 */
const providers = $derived(
  $providerInfos
    .filter(({ inferenceConnections }) => inferenceConnections.length > 0)
    .map(({ internalId, name }) => ({
      value: internalId,
      label: name,
    })),
);
let selectedProvider = $state<undefined | string>(undefined);

/**
 * Selecting connection
 */

const inferences = $derived(
  $providerInfos.flatMap(p => p.inferenceConnections).map(({ name }) => ({ value: name, label: name })),
);
let selectedConnection = $state<undefined | string>();

let loading: boolean = $state(false);
let error: string | undefined = $state(undefined);

let result: string | undefined = $state(undefined);

async function handleSubmit(): Promise<void> {
  if (loading) return;
  if (!model) throw new Error('model is required');
  if (!prompt) throw new Error('prompt is required');
  if (!selectedProvider) throw new Error('selectedProvider is required');
  if (!selectedConnection) throw new Error('selectedConnection is required');

  try {
    error = undefined;
    loading = true;
    result = undefined;
    result = await window.inferenceGenerate(selectedProvider, selectedConnection, model, prompt);
  } catch (err: unknown) {
    console.error(err);
    error = String(err);
  } finally {
    loading = false;
  }
}
</script>

<div class="max-w-2xl mx-auto p-6 rounded-lg">
  <form class="space-y-4">
    <div>
      {#if error}
        <ErrorMessage error={error}/>
      {/if}

      <!-- provider -->
      <label for="select-provider" class="block text-sm font-medium">Provider</label>
      <select
        id="select-provider"
        bind:value={selectedProvider}
        class="mt-1 block w-full rounded-md shadow-sm"
      >
        <option value="" disabled selected>Choose an option...</option>
        {#each providers as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>

      <!-- connection -->
      <label for="model" class="block text-sm font-medium">Inference connection</label>
      <select
        id="select-input"
        bind:value={selectedConnection}
        class="mt-1 block w-full rounded-md shadow-sm"
      >
        <option value="" disabled selected>Choose an option...</option>
        {#each inferences as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>

      <label for="model" class="mt-1 block text-sm font-medium">Model</label>
      <input
        type="text"
        id="model"
        bind:value={model}
        class="mt-1 block w-full rounded-md shadow-sm"
        placeholder="Enter model name"
        required
      />
    </div>

    <div>
      <label for="prompt" class="block text-sm font-medium">Prompt</label>
      <textarea
        id="prompt"
        bind:value={prompt}
        rows="4"
        class="mt-1 block w-full rounded-md shadow-sm"
        placeholder="Enter your prompt"
        required
      ></textarea>
    </div>

    <Button disabled={loading} inProgress={loading} onclick={handleSubmit}>
      Submit
    </Button>

    {#if result}
      <Markdown markdown={result} />
    {/if}
  </form>
</div>
