<script lang="ts">
import type { components } from 'mcp-registry';

interface Props {
  object: components['schemas']['Package'];
  loading: boolean;
  packageIndex: number;
}

let { loading = $bindable(false) }: Props = $props();
</script>

