<script lang="ts">
import { Button, Input } from '@podman-desktop/ui-svelte';

import { Textarea } from '/@/lib/chat/components/ui/textarea';
import Dialog from '/@/lib/dialogs/Dialog.svelte';
import type { InputField } from '/@/lib/flows/types/input-field';

interface Props {
  field?: InputField;
  onSave: (field: InputField) => void;
  onCancel: () => void;
}

let { field, onSave, onCancel }: Props = $props();

let name = $state(field?.name ?? '');
let description = $state(field?.description ?? '');
let type = $state<'string' | 'number' | 'boolean' | 'enum'>(
  (field?.format as 'string' | 'number' | 'boolean' | 'enum') ?? 'string',
);
let defaultValue = $state(field?.default ?? '');

// Validation
const nameValid = $derived(name.trim().length > 0 && /^[a-z][a-z0-9_]*$/.test(name));
const descriptionValid = $derived(description.trim().length > 0);
const formValid = $derived(nameValid && descriptionValid);

let nameError = $state('');
let descriptionError = $state('');

function validateName(): void {
  if (name.trim().length === 0) {
    nameError = 'Field name is required';
  } else if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    nameError = 'Name must start with lowercase letter and contain only lowercase letters, numbers, and underscores';
  } else {
    nameError = '';
  }
}

function validateDescription(): void {
  if (description.trim().length === 0) {
    descriptionError = 'Description is required';
  } else {
    descriptionError = '';
  }
}

function handleSave(): void {
  validateName();
  validateDescription();

  if (!formValid) return;

  const trimmedDefaultValue = defaultValue.trim();

  onSave({
    name: name.trim(),
    description: description.trim(),
    format: type,
    default: trimmedDefaultValue || undefined,
    required: !trimmedDefaultValue, // Required if no default value
  });
}
</script>

<Dialog title={field ? 'Edit Input Field' : 'Add Input Field'} onclose={onCancel}>
  {#snippet content()}
    <div class="space-y-3">
      <!-- Field Name -->
      <div>
        <label for="field-name" class="block mb-1 text-sm font-medium">
          Field Name <span class="text-[var(--pd-state-error)]">*</span>
        </label>
        <Input
          id="field-name"
          bind:value={name}
          placeholder="repository_url"
          required
          aria-invalid={nameError !== ''}
          oninput={validateName}
        />
        <p class="text-xs opacity-70 mt-1">
          Use lowercase with underscores. This will be used as {`{{${name}}}`} in your prompt.
        </p>
        {#if nameError}
          <p class="text-xs text-[var(--pd-state-error)] mt-1">{nameError}</p>
        {/if}
      </div>

      <!-- Description -->
      <div>
        <label for="field-description" class="block mb-1 text-sm font-medium">
          Description <span class="text-[var(--pd-state-error)]">*</span>
        </label>
        <Textarea
          id="field-description"
          bind:value={description}
          placeholder="GitHub repository URL (e.g., owner/repo)"
          class="bg-muted resize-none rounded-md"
          rows={2}
          aria-invalid={descriptionError !== ''}
          onblur={validateDescription}
        />
        {#if descriptionError}
          <p class="text-xs text-[var(--pd-state-error)] mt-1">{descriptionError}</p>
        {/if}
      </div>

      <!-- Type -->
      <div>
        <div id="field-type-label" class="block mb-1 text-sm font-medium">
          Type <span class="text-[var(--pd-state-error)]">*</span>
        </div>
        <div class="grid grid-cols-4 gap-2" role="group" aria-labelledby="field-type-label">
          <button
            type="button"
            disabled
            class="p-2 rounded border-2 flex flex-col items-center gap-1 bg-[var(--pd-button-primary-bg)] text-[var(--pd-button-text)] border-[var(--pd-button-primary-bg)] opacity-100"
          >
            <span class="text-xl">T</span>
            <span class="text-xs">Text</span>
          </button>
          
          <!-- Future types: Number, Boolean, Enum - uncomment when ready -->
        </div>
      </div>

      <!-- Default Value -->
      <div>
        <label for="field-default" class="block mb-1 text-sm font-medium">
          Default Value
        </label>
        <Input id="field-default" bind:value={defaultValue} placeholder="Optional default value" />
        <p class="text-xs opacity-70 mt-1">
          Leave empty to make this field required. Provide a value to make it optional.
        </p>
      </div>
    </div>
  {/snippet}

  {#snippet buttons()}
    <Button type="link" onclick={onCancel}>Cancel</Button>
    <Button disabled={!formValid} onclick={handleSave}>Save</Button>
  {/snippet}
</Dialog>

