<script lang="ts">
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import Fa, { type IconSize } from 'svelte-fa';

let {
  size,
}: {
  size?: IconSize;
} = $props();
</script>

<Fa icon={faPenToSquare} size={size}/>
