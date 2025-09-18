<script lang="ts">
import { faKey } from '@fortawesome/free-solid-svg-icons/faKey';
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons/faPlusCircle';
import { Button, Input } from '@podman-desktop/ui-svelte';
import type { components } from 'mcp-registry';
import { SvelteMap } from 'svelte/reactivity';
import Fa from 'svelte-fa';

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

/**
 * Let's build a map for all our expected headers with the default value selected
 */
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

<div class="flex flex-col gap-y-4">
  <!-- remote details -->
  <div class="bg-[var(--pd-content-bg)] rounded-md flex flex-col p-2 space-y-2">
    <label for="headers" class="text-xl font-bold text-[var(--pd-content-card-header-text)]">Remote Server Configuration</label>
    <span>Configure the remote Model Context Protocol server connection</span>

    <label for="server-url" class="text-base font-bold text-[var(--pd-content-card-header-text)]">Server URL *</label>
    <Input id="server-url" readonly value={object.url}/>
  </div>

  <!-- headers -->
  {#if (object.headers ?? []).length > 0}
    <div class="bg-[var(--pd-content-bg)] rounded-md flex flex-col p-2 space-y-2">
      <div class="flex flex-row items-center gap-x-2">
        <Fa icon={faKey} />
        <label for="headers" class="text-xl font-bold text-[var(--pd-content-card-header-text)]">Headers</label>
      </div>

      <span>Configure headers for authentication and other purposes</span>
      <label for="http-headers" class="text-base font-bold text-[var(--pd-content-card-header-text)]">HTTP Headers</label>
      {#each (object.headers ?? []) as header (header.name)}
        <div class="border-2 border-dashed rounded-md p-4">

          <label for="header-{header.name}" class="text-xl font-bold text-[var(--pd-content-card-header-text)]">{header.name} {header.is_required ? '*' : ''}</label>
          <InputArgumentWithVariables
            onChange={onHeaderChange.bind(undefined, header.name)}
            onVariableChange={onHeaderVariableChange.bind(undefined, header.name)}
            object={header}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<div class="flex w-full justify-end">
  <Button
    class="w-auto"
    icon={faPlusCircle}
    onclick={submit}
    inProgress={loading}>
    Setup
  </Button>
</div>

