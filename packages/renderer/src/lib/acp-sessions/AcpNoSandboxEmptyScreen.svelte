<script lang="ts">
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import { EmptyScreen } from '@podman-desktop/ui-svelte';
</script>

<EmptyScreen
  icon={faRobot}
  title="No ready sandboxes"
  message="A ready sandbox is required to create an agent session. Create a workspace first."
/>
