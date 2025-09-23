<script lang="ts">
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faTableList } from '@fortawesome/free-solid-svg-icons/faTableList';
import { faWrench } from '@fortawesome/free-solid-svg-icons/faWrench';
import { Button } from '@podman-desktop/ui-svelte';
import type { components } from 'mcp-registry';
import { SvelteMap } from 'svelte/reactivity';

import FormSection from '/@/lib/mcp/setup/FormSection.svelte';
import { createInputWithVariables } from '/@/lib/mcp/setup/input-with-variable-response-utils';
import type { InputWithVariableResponse, MCPSetupPackageOptions } from '/@api/mcp/mcp-setup';

interface Props {
  object: components['schemas']['Package'];
  loading: boolean;
  packageIndex: number;
  submit: (options: MCPSetupPackageOptions) => Promise<void>;
  cancel: () => void;
}

let { object, packageIndex, loading = $bindable(false), submit, cancel }: Props = $props();

let runtimeArgumentsResponses = new SvelteMap<number, InputWithVariableResponse>(
  (object.runtime_arguments ?? []).map((argument, index) => [index, createInputWithVariables(argument)]),
);
let packageArgumentsResponses = new SvelteMap<number, InputWithVariableResponse>(
  (object.package_arguments ?? []).map((argument, index) => [index, createInputWithVariables(argument)]),
);
let environmentVariablesResponses = new SvelteMap<string, InputWithVariableResponse>(
  (object.environment_variables ?? []).map(argument => [argument.name, createInputWithVariables(argument)]),
);

function updateArgumentValue<K extends string | number>(
  store: Map<K, InputWithVariableResponse>,
  key: K,
  value: string,
): void {
  const existing = store.get(key);
  if (!existing)
    throw new Error(
      `error in updateArgumentValue: cannot find object with key ${key} in provided store accepted keys are ${Object.keys(store).join(', ')}`,
    );

  store.set(key, {
    value: value,
    variables: existing.variables,
  });
}

function updateArgumentVariableValue<K extends string | number>(
  store: Map<K, InputWithVariableResponse>,
  key: K,
  variable: string,
  value: string,
): void {
  const existing = store.get(key);
  if (!existing)
    throw new Error(
      `error in updateArgumentVariableValue: cannot find object with key ${key} in provided store accepted keys are ${Object.keys(store).join(', ')}`,
    );

  store.set(key, {
    value: existing.value,
    variables: {
      ...existing.variables,
      [variable]: {
        value: value,
      },
    },
  });
}

async function spawn(): Promise<void> {
  return submit({
    type: 'package',
    index: packageIndex,
    runtimeArguments: Object.fromEntries(runtimeArgumentsResponses.entries()),
    packageArguments: Object.fromEntries(packageArgumentsResponses.entries()),
    environmentVariables: Object.fromEntries(environmentVariablesResponses.entries()),
  });
}
</script>

<div class="flex flex-col gap-y-4">
  <!-- package details -->
  <div class="bg-[var(--pd-content-bg)] rounded-md flex flex-col p-2 space-y-2">
    <label for="headers" class="text-xl font-bold text-[var(--pd-content-card-header-text)]">Remote MCP Definition</label>
    <span>Configure the remote Model Context Protocol server connection</span>

    <div class="grid grid-flow-col gap-x-4">
      <!-- registry type -->
      <div class="flex flex-col">
        <label for="server-url" class="text-base font-bold text-[var(--pd-content-card-header-text)] mb-1">Registry</label>
        <div class="flex items-center bg-[var(--pd-label-bg)] p-1 rounded-md text-sm text-[var(--pd-label-text)] gap-x-1 w-max px-2 py-1">
          <span>{object.registry_type}</span>
          {#if object.registry_base_url}
            <span>({object.registry_base_url})</span>
          {/if}
        </div>
      </div>
      <!-- package identifier -->
      <div class="flex flex-col">
        <label for="server-url" class="text-base font-bold text-[var(--pd-content-card-header-text)] mb-1">Package</label>
        <div class="flex items-center bg-[var(--pd-label-bg)] p-1 rounded-md text-sm text-[var(--pd-label-text)] gap-x-1 w-max px-2 py-1">
          {object.identifier}
        </div>
      </div>
      <!-- version -->
      {#if object.version}
        <div class="flex flex-col">
          <label for="server-url" class="text-base font-bold text-[var(--pd-content-card-header-text)] mb-1">Version</label>
          <div class="flex items-center bg-[var(--pd-label-bg)] p-1 rounded-md text-sm text-[var(--pd-label-text)] gap-x-1 w-max px-2 py-1">
            {object.version}
          </div>
        </div>
      {/if}
    </div>
  </div>

  {#if object.runtime_arguments?.length}
    <FormSection
      title="Runtime Arguments"
      icon={faWrench}
      args={object.runtime_arguments.map((argument, index) => ({...argument, key: index }))}
      updateArgumentValue={updateArgumentValue.bind(undefined, runtimeArgumentsResponses)}
      updateArgumentVariableValue={updateArgumentVariableValue.bind(undefined, runtimeArgumentsResponses)}
    />
  {/if}

  {#if object.package_arguments?.length}
    <FormSection
      title="Package Arguments"
      icon={faWrench}
      args={object.package_arguments.map((argument, index) => ({...argument, key: index }))}
      updateArgumentValue={updateArgumentValue.bind(undefined, packageArgumentsResponses)}
      updateArgumentVariableValue={updateArgumentVariableValue.bind(undefined, packageArgumentsResponses)}
    />
  {/if}

  {#if object.environment_variables?.length}
    <FormSection
      title="Environment Variables"
      icon={faTableList}
      args={object.environment_variables.map((argument) => ({...argument, key: argument.name }))}
      updateArgumentValue={updateArgumentValue.bind(undefined, environmentVariablesResponses)}
      updateArgumentVariableValue={updateArgumentVariableValue.bind(undefined, environmentVariablesResponses)}
    />
  {/if}
</div>

<div class="flex w-full justify-end gap-x-2">
  <Button type="secondary" onclick={cancel}>
    Cancel
  </Button>
  <Button
    class="w-auto"
    icon={faPlay}
    onclick={spawn}
    inProgress={loading}>
    Spawn
  </Button>
</div>
