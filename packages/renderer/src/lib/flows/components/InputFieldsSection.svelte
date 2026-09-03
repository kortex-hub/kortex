<script lang="ts">
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';

import { withConfirmation } from '/@/lib/dialogs/messagebox-utils';

import type { InputField } from '../types/input-field';
import InputFieldModal from './InputFieldModal.svelte';
import InputFieldTable from './InputFieldTable.svelte';

interface Props {
  parameters: InputField[];
  onDetectFields: () => Promise<void>;
  detectingFields: boolean;
  hasPrompt: boolean;
}

let { parameters = $bindable(), onDetectFields, detectingFields, hasPrompt }: Props = $props();

// Modal state
let showInputFieldModal = $state(false);
let editingFieldIndex = $state<number | undefined>(undefined);
let editingField = $state<InputField | undefined>(undefined);

function handleAddInputField(): void {
  editingFieldIndex = undefined;
  editingField = undefined;
  showInputFieldModal = true;
}

function handleEditInputField(index: number, field: InputField): void {
  editingFieldIndex = index;
  editingField = field;
  showInputFieldModal = true;
}

function handleDeleteInputField(index: number, field: InputField): void {
  withConfirmation(() => {
    parameters = parameters.filter((_, i) => i !== index);
  }, `delete parameter "${field.name}"`);
}

function handleSaveInputField(field: InputField): void {
  if (editingFieldIndex !== undefined) {
    // Edit existing
    parameters = parameters.map((p, i) => (i === editingFieldIndex ? field : p));
  } else {
    // Add new
    parameters = [...parameters, field];
  }
  showInputFieldModal = false;
}

function handleCancelInputField(): void {
  showInputFieldModal = false;
}
</script>

<div class="px-6">
  <div class="flex justify-between items-center mb-2">
    <span>Input Fields</span>
    <div class="flex gap-2">
      <Button
        onclick={onDetectFields}
        disabled={detectingFields || !hasPrompt}
        inProgress={detectingFields}
        title={hasPrompt 
          ? 'Analyze prompt to detect parameters' 
          : 'Enter a prompt first to enable field detection'}
      >
        {detectingFields ? 'Detecting...' : 'Detect Fields'}
      </Button>
      <Button onclick={handleAddInputField}>Add Field</Button>
    </div>
  </div>

  <div class="mb-3 p-3 bg-[var(--pd-content-card-bg)] border border-[var(--pd-input-field-stroke)] rounded">
    <div class="flex flex-row gap-3">
      <div class="shrink-0 mt-0.5">
        <Icon size="1.1x" class="text-[var(--pd-state-info)]" icon={faCircleInfo} />
      </div>
      <p class="text-sm">
        Use <code class="px-1 py-0.5 bg-[var(--pd-content-bg)] rounded">{'{{field_name}}'}</code> in your prompt to reference input fields.
        Example: "Take the last 5 issues from <code class="px-1 py-0.5 bg-[var(--pd-content-bg)] rounded">{'{{repository_url}}'}</code>"
      </p>
    </div>
  </div>
</div>

<div class="flex min-w-full h-full">
  <InputFieldTable
    {parameters}
    onEdit={handleEditInputField}
    onDelete={handleDeleteInputField}
  />
</div>

{#if showInputFieldModal}
  <InputFieldModal
    field={editingField}
    onSave={handleSaveInputField}
    onCancel={handleCancelInputField}
  />
{/if}

