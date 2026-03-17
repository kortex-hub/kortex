<script lang="ts">
import { ErrorMessage, Spinner, Tab } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';
import { router } from 'tinro';

import DetailsCell from '/@/lib/details/DetailsCell.svelte';
import DetailsTable from '/@/lib/details/DetailsTable.svelte';
import DetailsTitle from '/@/lib/details/DetailsTitle.svelte';
import DetailsPage from '/@/lib/ui/DetailsPage.svelte';
import { getTabUrl, isTabSelected } from '/@/lib/ui/Util';
import Route from '/@/Route.svelte';
import type { AgentWorkspaceConfiguration } from '/@api/agent-workspace-info';

interface Props {
  workspaceId: string;
}

let { workspaceId }: Props = $props();

let loading: boolean = $state(true);
let configuration: AgentWorkspaceConfiguration | undefined = $state(undefined);
let error: string | undefined = $state(undefined);

onMount(() => {
  window
    .getAgentWorkspaceConfiguration(workspaceId)
    .then((config: AgentWorkspaceConfiguration) => {
      configuration = config;
    })
    .catch((err: unknown) => {
      error = String(err);
      console.error(err);
    })
    .finally(() => {
      loading = false;
    });
});
</script>

{#if loading}
  <div class="flex items-center justify-center h-full">
    <Spinner />
  </div>
{:else if error}
  <ErrorMessage error={error} />
{:else if configuration}
  <DetailsPage title={configuration.name ?? ''}>
    {#snippet tabsSnippet()}
      <Tab title="Summary" selected={isTabSelected($router.path, 'summary')} url={getTabUrl($router.path, 'summary')} />
    {/snippet}
    {#snippet contentSnippet()}
      <Route path="/summary" breadcrumb="Summary" navigationHint="tab">
        <div class="h-min">
          <DetailsTable>
            <tr>
              <DetailsTitle>Configuration</DetailsTitle>
            </tr>
            {#if configuration?.name}
              <tr>
                <DetailsCell>Name</DetailsCell>
                <DetailsCell>{configuration.name}</DetailsCell>
              </tr>
            {/if}
          </DetailsTable>
        </div>
      </Route>
    {/snippet}
  </DetailsPage>
{/if}
