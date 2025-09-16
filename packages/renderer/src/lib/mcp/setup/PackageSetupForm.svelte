<script lang="ts">
import type { components } from 'mcp-registry';

interface Props {
  object: components['schemas']['Package'];
  loading: boolean;
  packageIndex: number;
  close: () => void;
}

let { loading = $bindable(false) }: Props = $props();
</script>

<span>This form is not yet implemented :p</span>
