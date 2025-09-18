<script lang="ts">
import type { ComponentProps } from 'svelte';

import { Separator } from '/@/lib/chat/components/ui/separator/index.js';
import { cn } from '/@/lib/chat/utils/shadcn.js';

let { ref = $bindable(null), class: className, ...restProps }: ComponentProps<typeof Separator> = $props();
</script>

<Separator
	bind:ref
	data-slot="sidebar-separator"
	data-sidebar="separator"
	class={cn('bg-sidebar-border mx-2 w-auto', className)}
	{...restProps}
/>
