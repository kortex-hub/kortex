<script lang="ts">
import type { UIMessage } from '@ai-sdk/svelte';

import { TooltipProvider } from '/@/lib/chat/components/ui/tooltip';

import PreviewMessage from './preview-message.svelte';

let {
  message,
  messages,
  readonly,
  loading,
}: {
  message: UIMessage;
  messages: UIMessage[];
  readonly: boolean;
  loading: boolean;
} = $props();
</script>

<TooltipProvider>
  <PreviewMessage {message} {messages} {readonly} {loading} />
</TooltipProvider>
