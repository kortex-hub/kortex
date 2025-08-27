<script lang="ts">
import { Tab } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';
import { router } from 'tinro';

import MonacoEditor from '/@/lib/editor/MonacoEditor.svelte';
import DetailsPage from '/@/lib/ui/DetailsPage.svelte';
import { getTabUrl, isTabSelected } from '/@/lib/ui/Util';
import Route from '/@/Route.svelte';

interface Props {
  id: string;
}
let { id }: Props = $props();

let toolSet: string | undefined = $state(undefined);

onMount(() => {
  window
    .getMcpToolSet(id)
    .then(content => {
      toolSet = JSON.stringify(content, undefined, 2);
    })
    .catch(console.error);
});
</script>

<DetailsPage title={id}>
  {#snippet tabsSnippet()}
    <Tab title="Summary" selected={isTabSelected($router.path, 'summary')} url={getTabUrl($router.path, 'summary')} />
    <Tab title="Tools" selected={isTabSelected($router.path, 'tools')} url={getTabUrl($router.path, 'tools')} />
  {/snippet}
  {#snippet contentSnippet()}
    <Route path="/summary" breadcrumb="Summary" navigationHint="tab">
      <span>content for {id}</span>
    </Route>
    <Route path="/tools" breadcrumb="Tools" navigationHint="tab">
      {#if toolSet}
        <MonacoEditor readOnly content={toolSet} language="json"/>
      {/if}
    </Route>
  {/snippet}
</DetailsPage>
