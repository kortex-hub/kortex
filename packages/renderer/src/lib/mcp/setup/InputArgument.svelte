<script lang="ts">
import { Input } from '@podman-desktop/ui-svelte';
import type { components } from 'mcp-registry';

import Markdown from '/@/lib/markdown/Markdown.svelte';
import PasswordInput from '/@/lib/ui/PasswordInput.svelte';

interface Props {
  object: components['schemas']['Input'];
  readonly?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}

let { object, readonly, placeholder, onChange }: Props = $props();

let choices = $derived(object.choices ?? []);

function onInput(
  event: Event & {
    currentTarget: EventTarget & HTMLInputElement;
  },
): void {
  onChange(event.currentTarget.value);
}

function onSelectChange(
  e: Event & {
    currentTarget: EventTarget & HTMLSelectElement;
  },
): void {
  onChange(e.currentTarget.value);
}
</script>

<Markdown markdown={object.description} />
<div class="flex flex-row items-center gap-x-2">
  {#if object.is_secret}
    <PasswordInput oninput={onInput} password={object.value} readonly={readonly} placeholder={placeholder} />
  {:else if choices.length > 0}
    <select disabled={readonly} value={object.value} onchange={onSelectChange}>
      {#each choices as choice (choice)}
        <option value={choice} selected={object.value === choice}>{choice}</option>
      {/each}
    </select>
  {:else}
    <Input value={object.value} oninput={onInput} class="mb-2 w-full" placeholder={placeholder} required={object.is_required} readonly={readonly} />
  {/if}
</div>


