<script lang="ts">
import { scale } from 'svelte/transition';

import MessageIcon from '../icons/message.svelte';
</script>

<div class="mx-auto max-w-3xl md:mt-20" transition:scale={{ opacity: 0, start: 0.98 }}>
	<div class="flex max-w-xl flex-col gap-8 rounded-xl p-6 text-center leading-relaxed">
		<p class="flex flex-row items-center justify-center gap-4">
			<MessageIcon size={32} />
		</p>

	</div>
</div>
