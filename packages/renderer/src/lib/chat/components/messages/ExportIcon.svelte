<script lang="ts">
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import Fa, { type IconSize } from 'svelte-fa';

let {
  size,
}: {
  size: IconSize;
} = $props();
</script>

<Fa icon={faFileExport} size={size}/>
