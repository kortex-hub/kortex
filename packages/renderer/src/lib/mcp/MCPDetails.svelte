<script lang="ts">
import { Tab } from '@podman-desktop/ui-svelte';
import type { DynamicToolUIPart } from 'ai';
import { onMount } from 'svelte';
import { router } from 'tinro';

import ToolParts from '/@/lib/chat/components/messages/tool-parts.svelte';
import MonacoEditor from '/@/lib/editor/MonacoEditor.svelte';
import DetailsPage from '/@/lib/ui/DetailsPage.svelte';
import { getTabUrl, isTabSelected } from '/@/lib/ui/Util';
import Route from '/@/Route.svelte';

interface Props {
  id: string;
}
let { id }: Props = $props();

let toolSet: string | undefined = $state(undefined);
let messages: Array<DynamicToolUIPart> = $state([]);

async function refreshMessages(): Promise<void> {
  try {
    messages = await window.getMcpExchanges(id);
  } catch (e) {
    console.error('Failed to fetch MCP exchanges', e);
  }
}

onMount(() => {
  window
    .getMcpToolSet(id)
    .then(content => {
      toolSet = JSON.stringify(content, undefined, 2);
    })
    .catch(console.error);

  // Initial load of messages
  refreshMessages().catch(console.error);

  // Subscribe to updates from main process
  return window.events?.receive('mcp-manager-update', () => {
    refreshMessages().catch(console.error);
  });
});
</script>

<DetailsPage title={id}>
  {#snippet tabsSnippet()}
    <Tab title="Summary" selected={isTabSelected($router.path, 'summary')} url={getTabUrl($router.path, 'summary')} />
    <Tab title="Tools" selected={isTabSelected($router.path, 'tools')} url={getTabUrl($router.path, 'tools')} />
    <Tab title="Messages" selected={isTabSelected($router.path, 'messages')} url={getTabUrl($router.path, 'messages')} />
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
    <Route path="/messages" breadcrumb="Messages" navigationHint="tab">
      {#if messages.length > 0}
        <ToolParts tools={messages} />
      {:else}
        <div class="text-sm text-zinc-600 dark:text-zinc-400">No messages recorded yet.</div>
      {/if}
    </Route>
  {/snippet}
</DetailsPage>
