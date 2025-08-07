<script lang="ts">
import Chat from '/@/lib/chat/components/chat.svelte';
import { convertToUIMessages } from '/@/lib/chat/utils/chat';

let { data } = $props();
</script>

<Chat
	chat={data.chat}
	initialMessages={convertToUIMessages(data.messages)}
	readonly={data.user?.id !== data.chat.userId}
	user={data.user}
/>
<!-- TODO <DataStreamHandler {id} /> -->
