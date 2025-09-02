<script lang="ts">
import { Link } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';
</script>

<Link onclick={(): void => router.goto('/preferences/cli-tools')}>Install the Goose CLI</Link>
