<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';

import * as Tooltip from '/@/lib/chat/components/ui/tooltip/index.js';
import { cn, type WithElementRef } from '/@/lib/chat/utils/shadcn.js';

import { SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON } from './constants.js';
import { setSidebar } from './context.svelte.js';

let {
  ref = $bindable(null),
  open = $bindable(true),
  onOpenChange = (): void => {},
  class: className,
  style,
  children,
  ...restProps
}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = $props();

const sidebar = setSidebar({
  open: () => open,
  setOpen: (value: boolean) => {
    open = value;
    onOpenChange(value);
  },
});
</script>

<svelte:window onkeydown={sidebar.handleShortcutKeydown} />

<Tooltip.Provider delayDuration={0}>
	<div
		data-slot="sidebar-wrapper"
		style="--sidebar-width: {SIDEBAR_WIDTH}; --sidebar-width-icon: {SIDEBAR_WIDTH_ICON}; {style}"
		class={cn(
			'group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex w-full',
			className
		)}
		bind:this={ref}
		{...restProps}
	>
		{@render children?.()}
	</div>
</Tooltip.Provider>
