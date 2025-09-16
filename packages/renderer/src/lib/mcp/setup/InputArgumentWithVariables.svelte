<script lang="ts">
import type { components } from 'mcp-registry';

import InputArgument from '/@/lib/mcp/setup/InputArgument.svelte';

interface Props {
  object: components['schemas']['InputWithVariables'];
  onChange: (value: string) => void;
  onVariableChange: (variable: string, value: string) => void;
}

let { object, onChange, onVariableChange }: Props = $props();

let variables: Array<[string, components['schemas']['Input']]> = Object.entries(object.variables ?? {});
</script>

<!-- no variable => let's use InputArgument directly -->
{#if variables.length === 0}
  <InputArgument onChange={onChange} object={object} />
{:else if object.value}
  <InputArgument onChange={onChange} object={object} readonly />
{/if}

<h6>Variables</h6>
{#each Object.entries(object.variables ?? {}) as [key, value] (key)}
  <InputArgument placeholder={key} onChange={onVariableChange.bind(undefined, key)} object={value} />
{/each}
