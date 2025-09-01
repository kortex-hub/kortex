<script lang="ts">
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { Button, ErrorMessage, FormPage, Input } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';

import { mcpRegistriesServerInfos } from '/@/stores/mcp-registry-servers';

import Markdown from '../markdown/Markdown.svelte';
import PasswordInput from '../ui/PasswordInput.svelte';

interface Props {
  serverId: string;
}

const { serverId }: Props = $props();

const mcpRegistryServerDetail = $derived($mcpRegistriesServerInfos.find(server => server.id === serverId));

let createInProgress = $state(false);
let createFinished = $state(false);
let createError: string | undefined = $state(undefined);

// get first remote if any
const remote = $derived(mcpRegistryServerDetail ? mcpRegistryServerDetail.remotes?.[0] : undefined);

const remoteHeadersFields = $derived(
  (remote?.headers ?? []).map(header => {
    return { name: header.name ?? '', value: '', isSecret: header.is_secret, description: header.description ?? '' };
  }),
);

async function createMcpServer(): Promise<void> {
  if (!mcpRegistryServerDetail || !mcpRegistryServerDetail.id) {
    createError = 'MCP Registry Server Detail is not defined';
    return;
  }

  createError = undefined;
  // get first remote

  // FIX ME: handle only one remote for now
  const remoteid = 0;
  createInProgress = true;
  try {
    await window.createMCPServerFromRemoteRegistry(mcpRegistryServerDetail.id, remoteid, remoteHeadersFields);
  } catch (error) {
    console.error('Error creating MCP server from registry:', error);
    createError = String(error);
  } finally {
    createInProgress = false;
    createFinished = true;
  }
  if (!createError) {
    await navigateToMcps();
  }
}

async function navigateToMcps(): Promise<void> {
  router.goto('/mcps');
}
</script>

{#if mcpRegistryServerDetail}
  <FormPage title="Adding {mcpRegistryServerDetail.name}" inProgress={createInProgress} onclose={navigateToMcps}>
    {#snippet content()}
      <div class="p-5 min-w-full h-full flex flex-col text-sm space-y-5">
        <form on:submit|preventDefault={createMcpServer}>
          <div class="pb-4">
            <!-- for each header field, add an input field-->
            {#each remoteHeadersFields as headerField (headerField.name)}
              <label for="modalImageTag" class="block mb-2 text-sm font-medium text-[var(--pd-modal-text)]"
                ><Markdown markdown={headerField.description} /></label>

              {#if headerField.isSecret}
                <PasswordInput id={headerField.name} bind:password={headerField.value} />
              {:else}
                <Input id={headerField.name} bind:value={headerField.value} class="mb-2 w-full" required />
              {/if}
            {/each}
          </div>
          {#if createError}
            <ErrorMessage error={createError} />
          {/if}

          {#if !createFinished || createError}
            <div class="flex w-full justify-end">
              <Button
                class="w-auto"
                icon={faPlusCircle}
                on:click={async (): Promise<void> => {
                  await createMcpServer();
                }}
                inProgress={createInProgress}>
                Create
              </Button>
            </div>
          {/if}
        </form>
      </div>
    {/snippet}
  </FormPage>
{/if}
