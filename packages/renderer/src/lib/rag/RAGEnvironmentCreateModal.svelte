<script lang="ts">
import { Button, CloseButton, Input, Modal } from '@podman-desktop/ui-svelte';

import type { ProviderInfo } from '/@api/provider-info';

interface Props {
  providers: ProviderInfo[];
  closeCallback: () => void;
  onCreate: (
    name: string,
    ragConnection: { name: string; providerId: string },
    chunkerConnection: { id: string; providerId: string },
  ) => void;
}

let { providers, closeCallback, onCreate }: Props = $props();

let environmentName = $state('');
let selectedRagConnectionKey = $state('');
let selectedChunkerConnectionKey = $state('');

let ragConnectionOptions = $derived(
  providers.flatMap(provider =>
    provider.ragConnections.map(connection => ({
      key: `${provider.id}:${connection.name}`,
      providerId: provider.id,
      connection: connection,
      displayName: connection.name,
      providerName: provider.name,
    })),
  ),
);

let chunkConnectionOptions = $derived(
  providers.flatMap(provider =>
    provider.chunkConnections.map(connection => ({
      key: `${provider.id}:${connection.id}`,
      providerId: provider.id,
      connection: connection,
      displayName: connection.name,
      providerName: provider.name,
    })),
  ),
);

const selectedRagOption = $derived(ragConnectionOptions.find(option => option.key === selectedRagConnectionKey));
const selectedChunkOption = $derived(
  chunkConnectionOptions.find(option => option.key === selectedChunkerConnectionKey),
);

let isFormValid = $derived(
  environmentName.trim() !== '' && selectedRagOption !== undefined && selectedChunkOption !== undefined,
);

function handleCreate(): void {
  if (!isFormValid) return;

  if (!selectedRagOption || !selectedChunkOption) return;

  onCreate(
    environmentName.trim(),
    {
      name: selectedRagOption.connection.name,
      providerId: selectedRagOption.providerId,
    },
    {
      id: selectedChunkOption.connection.id,
      providerId: selectedChunkOption.providerId,
    },
  );
}

function onNameInput(
  event: Event & {
    currentTarget: EventTarget & HTMLInputElement;
  },
): void {
  environmentName = event.currentTarget.value;
}

function selectRagConnection(key: string): void {
  selectedRagConnectionKey = key;
}

function selectChunkConnection(key: string): void {
  selectedChunkerConnectionKey = key;
}
</script>

<Modal on:close={closeCallback}>
  <div class="inline-block w-full overflow-hidden text-left transition-all" aria-label="create knowledge environment">
    <div
      class="flex items-center justify-between px-6 py-5 mb-0 text-[var(--pd-modal-header-text)] bg-[var(--pd-modal-header-bg)] border-b border-[var(--pd-modal-header-border)]">
      <h1 class="text-lg font-semibold">New Knowledge Environment</h1>
      <CloseButton class="px-2 py-1" onclick={closeCallback} />
    </div>
    <div class="overflow-y-auto px-6 py-6 text-[var(--pd-modal-text)]">
      <div class="flex flex-col space-y-8">
        <!-- Environment Name -->
        <div class="flex flex-col space-y-2">
          <label for="environmentName" class="text-sm font-medium text-[var(--pd-modal-text)]">Environment Name</label>
          <Input
            id="environmentName"
            value={environmentName}
            oninput={onNameInput}
            placeholder="Enter knowledge environment name"
            required
            class="w-full" />
        </div>

        <!-- Vector Store Selection -->
        <div role="group" aria-label="Vector Store" class="flex flex-col space-y-3">
          <label class="text-sm font-medium text-[var(--pd-modal-text)]">Vector Store</label>
          <div class="grid grid-cols-2 gap-4">
            {#each ragConnectionOptions as option (option.key)}
              <button
                type="button"
                class="border-2 rounded-lg p-4 text-left transition-all cursor-pointer {selectedRagConnectionKey ===
                option.key
                  ? 'border-[var(--pd-content-card-border-selected)] bg-[var(--pd-content-card-hover-inset-bg)]'
                  : 'border-[var(--pd-content-card-border)] bg-[var(--pd-content-card-bg)] hover:border-[var(--pd-content-card-border-selected)] hover:bg-[var(--pd-content-card-hover-inset-bg)]'}"
                onclick={selectRagConnection.bind(undefined, option.key)}>
                <div class="flex items-center gap-3 mb-2">
                  <div
                    class="w-8 h-8 rounded-md flex items-center justify-center text-[var(--pd-label-primary-text)] text-xs font-bold bg-[var(--pd-label-primary-bg)]">
                    {option.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div class="text-base font-medium text-[var(--pd-modal-text)]">{option.displayName}</div>
                </div>
                <div class="text-xs text-[var(--pd-content-text)] leading-relaxed">
                  {option.providerName}
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Embedding Model Selection -->
        <div role="group" aria-label="Embedding Model" class="flex flex-col space-y-3">
          <label class="text-sm font-medium text-[var(--pd-modal-text)]">Embedding Model</label>
          <div class="grid grid-cols-2 gap-4">
            {#each chunkConnectionOptions as option (option.key)}
              <button
                type="button"
                class="border-2 rounded-lg p-4 text-left transition-all cursor-pointer {selectedChunkerConnectionKey ===
                option.key
                  ? 'border-[var(--pd-content-card-border-selected)] bg-[var(--pd-content-card-hover-inset-bg)]'
                  : 'border-[var(--pd-content-card-border)] bg-[var(--pd-content-card-bg)] hover:border-[var(--pd-content-card-border-selected)] hover:bg-[var(--pd-content-card-hover-inset-bg)]'}"
                onclick={selectChunkConnection.bind(undefined, option.key)}>
                <div class="flex items-center gap-3 mb-2">
                  <div
                    class="w-8 h-8 rounded-md flex items-center justify-center text-[var(--pd-label-primary-text)] text-xs font-bold bg-[var(--pd-label-primary-bg)]">
                    {option.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div class="text-base font-medium text-[var(--pd-modal-text)]">{option.displayName}</div>
                </div>
                <div class="text-xs text-[var(--pd-content-text)] leading-relaxed">
                  {option.providerName}
                </div>
              </button>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div
      class="flex flex-row justify-end gap-3 px-6 py-5 border-t border-[var(--pd-modal-header-border)] bg-[var(--pd-modal-header-bg)]">
      <Button type="secondary" onclick={closeCallback}>Cancel</Button>
      <Button aria-label="Create Environment" disabled={!isFormValid} onclick={handleCreate}>Create Environment</Button>
    </div>
  </div>
</Modal>
