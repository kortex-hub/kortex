<script lang="ts">
import { faPencil } from '@fortawesome/free-solid-svg-icons/faPencil';
import { Button, EmptyScreen } from '@podman-desktop/ui-svelte';

import NoLogIcon from '/@/lib/ui/NoLogIcon.svelte';

interface Props {
  onclick(): void;
}

let { onclick }: Props = $props();
</script>

<EmptyScreen title="No flow" icon={NoLogIcon} >
  <Button icon={faPencil} onclick={onclick}>
    Create
  </Button>
</EmptyScreen>
