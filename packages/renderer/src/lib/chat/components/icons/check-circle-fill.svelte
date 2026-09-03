<script lang="ts">
import { faCircleCheck } from '@fortawesome/free-regular-svg-icons';
import Fa, { type IconSize } from 'svelte-fa';

let {
  size,
}: {
  size?: IconSize;
} = $props();
</script>

<Fa icon={faCircleCheck} {size} />
