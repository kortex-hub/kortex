<script lang="ts">
import type { UIMessage } from '@ai-sdk/svelte';

import { TooltipProvider } from '/@/lib/chat/components/ui/tooltip';

import PreviewMessage from './preview-message.svelte';

let {
  readonly,
  loading,
}: {
  readonly: boolean;
  loading: boolean;
} = $props();

let parts: UIMessage['parts'] = $state([]);

let reactiveMessage: UIMessage = $derived({
  id: 'msg1',
  role: 'assistant',
  parts,
});

let reactiveMessages: UIMessage[] = $derived([reactiveMessage]);

export function addPart(part: UIMessage['parts'][number]): void {
  parts.push(part);
}

export function setParts(newParts: UIMessage['parts']): void {
  parts = newParts;
}
</script>

<TooltipProvider>
  <PreviewMessage message={reactiveMessage} messages={reactiveMessages} {readonly} {loading} />
</TooltipProvider>
