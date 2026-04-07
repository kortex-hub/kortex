<script lang="ts">
import type { UIMessage } from '@ai-sdk/svelte';

import { TooltipProvider } from '/@/lib/chat/components/ui/tooltip';

import MessageActions from './message-actions.svelte';

let {
  message,
  readonly,
}: {
  message: UIMessage;
  readonly: boolean;
} = $props();
</script>

<TooltipProvider>
  <MessageActions {message} {readonly} />
</TooltipProvider>
