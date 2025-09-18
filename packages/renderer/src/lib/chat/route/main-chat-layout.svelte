<script lang="ts">
import { ThemeProvider } from '@sejohnson/svelte-themes';

import { Toaster } from '/@/lib/chat/components/ui/sonner';

let { children } = $props();
</script>

<ThemeProvider attribute="class" disableTransitionOnChange>
	<Toaster position="top-center" />
	{@render children()}
</ThemeProvider>
