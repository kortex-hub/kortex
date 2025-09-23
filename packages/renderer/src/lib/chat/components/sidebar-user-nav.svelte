<script lang="ts">
import type { User } from '../../../../../main/src/chat/db/schema';
import { SidebarMenu, SidebarMenuItem } from './ui/sidebar';

let { user }: { user: User } = $props();
</script>

<SidebarMenu>
	<SidebarMenuItem>
		<span class="truncate">{user?.email}</span>
	</SidebarMenuItem>
</SidebarMenu>
