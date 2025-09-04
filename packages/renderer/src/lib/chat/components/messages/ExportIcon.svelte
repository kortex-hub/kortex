<script lang="ts">
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import Fa from 'svelte-fa';

let {
  scale,
}: {
  scale: number;
} = $props();
</script>

<Fa icon={faFileExport} scale={scale}/>
