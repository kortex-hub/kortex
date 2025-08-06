<script lang="ts">
	import Chat from '/@/lib/chat/components/chat.svelte';

	let { data } = $props();
</script>

<Chat chat={undefined} initialMessages={[]} readonly={false} user={data.user} />
<!-- TODO <DataStreamHandler {id} /> -->
