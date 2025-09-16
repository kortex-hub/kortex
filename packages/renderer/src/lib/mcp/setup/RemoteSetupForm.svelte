<script lang="ts">
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import type { components } from 'mcp-registry';
import { SvelteMap } from 'svelte/reactivity';

import InputArgumentWithVariables from '/@/lib/mcp/setup/InputArgumentWithVariables.svelte';
import type { InputWithVariableResponse } from '/@api/mcp/mcp-setup';

interface Props {
  object: components['schemas']['Remote'];
  loading: boolean;
  serverId: string;
  remoteIndex: number;
  close: () => void;
}

let { object, close, serverId, remoteIndex, loading = $bindable(false) }: Props = $props();

let responses: Map<string, InputWithVariableResponse> = new SvelteMap(
  (object.headers ?? []).map(header => [
    header.name,
    {
      value: header.value ?? header.default ?? '',
      variables: Object.fromEntries(
        Object.entries(header.variables ?? {}).map(([key, variable]) => [
          key,
          {
            value: variable.value ?? variable.default ?? '',
          },
        ]),
      ),
    },
  ]),
);

async function submit(): Promise<void> {
  try {
    loading = true;
    await window.setupMCP(serverId, {
      type: 'remote',
      index: remoteIndex,
      headers: Object.fromEntries(responses.entries()),
    });
    close();
  } finally {
    loading = false;
  }
}

function onHeaderChange(header: string, value: string): void {
  const existing = responses.get(header);
  if (!existing) throw new Error(`header ${header} is not recognised`);

  responses.set(header, {
    value: value,
    variables: existing.variables,
  });
}

function onHeaderVariableChange(header: string, variable: string, value: string): void {
  const existing = responses.get(header);
  if (!existing) throw new Error(`header ${header} is not recognised`);

  responses.set(header, {
    value: existing.value,
    variables: {
      ...existing.variables,
      [variable]: {
        value: value,
      },
    },
  });
}
</script>

<h3>Configuring remote MCP for {object.url}</h3>
<h4>Headers</h4>
{#each (object.headers ?? []) as header (header.name)}
  <h5>{header.name}</h5>
  <InputArgumentWithVariables
    onChange={onHeaderChange.bind(undefined, header.name)}
    onVariableChange={onHeaderVariableChange.bind(undefined, header.name)}
    object={header}
  />
{/each}

<div class="flex w-full justify-end">
  <Button
    class="w-auto"
    icon={faPlusCircle}
    onclick={submit}
    inProgress={loading}>
    Setup
  </Button>
</div>

