<script lang="ts">
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons/faFolderOpen';
import { EmptyScreen } from '@podman-desktop/ui-svelte';
</script>

<EmptyScreen title="No projects" icon={faFolderOpen}>
  <span class="text-(--pd-content-text)">
    Projects will appear here once created.
  </span>
</EmptyScreen>
