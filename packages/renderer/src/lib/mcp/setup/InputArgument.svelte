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

function onInput(
  event: Event & {
    currentTarget: EventTarget & HTMLInputElement;
  },
): void {
  onChange(event.currentTarget.value);
}
</script>

<Markdown markdown={object.description} />
{#if object.is_secret}
  <PasswordInput oninput={onInput} password={object.value} readonly={readonly} placeholder={placeholder} />
{:else}
  <Input value={object.value} oninput={onInput} class="mb-2 w-full"  placeholder={placeholder} required={object.is_required} readonly={readonly} />
{/if}
