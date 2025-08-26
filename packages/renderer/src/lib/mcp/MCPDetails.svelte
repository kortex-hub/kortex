<script lang="ts">
import DetailsPage from '/@/lib/ui/DetailsPage.svelte';

interface Props {
  id: string;
}
let { id }: Props = $props();
</script>

<DetailsPage title={id}>
  {#snippet contentSnippet()}
    <span>content for {id}</span>
  {/snippet}
</DetailsPage>
