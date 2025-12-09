<script lang="ts">
import { Button, Input } from '@podman-desktop/ui-svelte';
import { z } from 'zod';

import { Textarea } from '/@/lib/chat/components/ui/textarea';
import Dialog from '/@/lib/dialogs/Dialog.svelte';
import { type InputField, InputFieldSchema } from '/@/lib/flows/types/input-field';

interface Props {
  field?: InputField;
  onSave: (field: InputField) => void;
  onCancel: () => void;
}

let { field, onSave, onCancel }: Props = $props();

let name = $state(field?.name ?? '');
let description = $state(field?.description ?? '');

let type = $state(field?.format ?? 'string');
let defaultValue = $state(field?.default ?? '');

let nameFieldTouched = $state(false);
let descriptionFieldTouched = $state(false);

function handleTouchedNameInput(): void {
  nameFieldTouched = true;
}

function handleTouchedDescriptionInput(): void {
  descriptionFieldTouched = true;
}

let computedRequired = $derived(!defaultValue.trim());

const parseResult = $derived(
  InputFieldSchema.safeParse({
    name,
    description,
    format: type,
    default: defaultValue.trim() || undefined,
    required: computedRequired,
  }),
);

const errors = $derived(!parseResult.success ? z.treeifyError(parseResult.error).properties : undefined);

function handleSave(): void {
  if (!parseResult.success) {
    return;
  }

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
          placeholder="parameter name (e.g., repository_url)"
          required
          aria-invalid={nameFieldTouched && !!errors?.name?.errors.length}
          oninput={handleTouchedNameInput}
        />
        <p class="text-xs opacity-70 mt-1">
          Use lowercase with underscores. This will be used as {`{{${name}}}`} in your prompt.
        </p>
        {#if nameFieldTouched}
            {#each errors?.name?.errors ?? [] as error (error)}
               <p class="text-xs text-[var(--pd-state-error)] mt-1">{error}</p>
            {/each}
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
          placeholder="parameter description (e.g., GitHub repository URL)"
          class="bg-muted resize-none rounded-md"
          rows={2}
          aria-invalid={descriptionFieldTouched && !!errors?.description?.errors.length}
          oninput={handleTouchedDescriptionInput}
        />
        {#if descriptionFieldTouched}
          {#each errors?.description?.errors ?? [] as error (error)}
             <p class="text-xs text-[var(--pd-state-error)] mt-1">{error}</p>
          {/each}
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
    <Button disabled={!parseResult.success} onclick={handleSave}>Save</Button>
  {/snippet}
</Dialog>
