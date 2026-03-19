<script lang="ts">
import type { Attachment } from '@ai-sdk/ui-utils';
import { Tooltip as TooltipPrimitive } from 'bits-ui';

import PreviewAttachment from './preview-attachment.svelte';

let {
  attachment,
  uploading = false,
  onremove,
}: {
  attachment: Attachment;
  uploading?: boolean;
  onremove?: () => void;
} = $props();
</script>

<TooltipPrimitive.Provider>
	<PreviewAttachment {attachment} {uploading} {onremove} />
</TooltipPrimitive.Provider>
