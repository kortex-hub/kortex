<script lang="ts">
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import Fa, { type IconSize } from 'svelte-fa';

let {
  size,
}: {
  size?: IconSize;
} = $props();
</script>

<Fa icon={faCopy} {size} />
