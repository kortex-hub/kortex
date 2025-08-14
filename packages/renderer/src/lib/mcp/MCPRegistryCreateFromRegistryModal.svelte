<script lang="ts">
import { faCheckCircle, faCircleArrowUp, faPlusCircle, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { Button, ErrorMessage, Input, Link } from '@podman-desktop/ui-svelte';
import { onMount} from 'svelte';
import Fa from 'svelte-fa';
import { router } from 'tinro';


  import type { MCPRegistryServerDetail } from '/@api/mcp/mcp-registry-server-entry';
  import Dialog from '/@/lib/dialogs/Dialog.svelte';
  import PasswordInput from '../ui/PasswordInput.svelte';

interface Props {
  mcpRegistryServerDetail: MCPRegistryServerDetail;
  closeCallback: () => void;
}

const {mcpRegistryServerDetail, closeCallback}: Props = $props();

let createInProgress = $state(false);
let createFinished = $state(false);
let createError: string | undefined = $state(undefined)

// get first remote if any
const remote = $derived(mcpRegistryServerDetail.remotes?.[0]);

const remoteHeadersFields = $derived((remote?.headers ?? []).map(header => {return {name: header.name ?? '', value: '', isSecret: header.is_secret, description: header.description ?? ''}}));


async function createMcpServer(): Promise<void> {

  // get first remote

  // FIXME: handle only one remote for now
  const remoteid = 0;
  createInProgress = true;
  try {
    await window.createMCPServerFromRemoteRegistry(mcpRegistryServerDetail.id, remoteid, remoteHeadersFields)
  } catch (error) {
    console.error('Error creating MCP server from registry:', error);
    createError = String(error);
  } finally {
    createInProgress = false;
    createFinished = true;
  }

}

async function creationFinished(): Promise<void> {
  closeCallback();
  router.goto('/mcps');
}

</script>

<Dialog
  title="Adding {mcpRegistryServerDetail.name}"
  onclose={closeCallback}>

  {#snippet content()}
  <div class="flex flex-col text-sm leading-5 space-y-5">
<form on:submit|preventDefault={createMcpServer}>

    <div class="pb-4">

      <!-- for each header field, add an input field-->
      {#each remoteHeadersFields as headerField }
      <label for="modalImageTag" class="block mb-2 text-sm font-medium text-[var(--pd-modal-text)]">{headerField.description}</label>

        {#if headerField.isSecret}
            <PasswordInput
            id={headerField.name}
                  bind:password={headerField.value}
                     />
        {:else}
        <Input
          id={headerField.name}
          bind:value={headerField.value}
          class="mb-2 w-full"
          required />
          {/if}
      {/each}


  </div>
  {#if createError}
   <ErrorMessage error={createError}/>
  {/if}
  </form>
  </div>

  {/snippet}

  {#snippet buttons()}
    {#if !createInProgress && !createFinished}
      <Button class="w-auto" type="secondary" on:click={closeCallback}>Cancel</Button>
    {/if}
    {#if !createFinished}
      <Button
        class="w-auto"
        icon={faPlusCircle}
        on:click={async (): Promise<void> => {
          await createMcpServer();
        }}
        inProgress={createInProgress}>
        Create
      </Button>
    {:else}
      <Button on:click={creationFinished} class="w-auto">Done</Button>
    {/if}
  {/snippet}
</Dialog>
