<script lang="ts">
import { Button, Dropdown, ErrorMessage } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';

import { Textarea } from '/@/lib/chat/components/ui/textarea';
import Dialog from '/@/lib/dialogs/Dialog.svelte';
import { agentInfos } from '/@/stores/agents';
import { allOpenshellSandboxes } from '/@/stores/openshell-sandboxes';
import { AGENT_LABEL } from '/@api/openshell-gateway-info';

interface Props {
  onclose: () => void;
}

let { onclose }: Props = $props();

let selectedSandboxName = $state('');
let selectedAgentId = $state('');
let prompt = $state('');
let creating = $state(false);
let error = $state<string | undefined>();

const readySandboxes = $derived($allOpenshellSandboxes.filter(s => s.phase === 'Ready'));
const acpAgents = $derived($agentInfos.filter(a => a.acp !== undefined));

const selectedSandbox = $derived(readySandboxes.find(s => s.name === selectedSandboxName));
const sandboxAgentId = $derived(selectedSandbox?.labels?.[AGENT_LABEL]);
const sandboxAgentInfo = $derived(sandboxAgentId ? $agentInfos.find(a => a.id === sandboxAgentId) : undefined);
const sandboxAgentSupportsAcp = $derived(!sandboxAgentId || sandboxAgentInfo?.acp !== undefined);
const needsAgentSelection = $derived(!sandboxAgentId);
const effectiveAgentId = $derived(sandboxAgentId ?? selectedAgentId);

$effect(() => {
  if (readySandboxes.length > 0 && !selectedSandboxName) {
    selectedSandboxName = readySandboxes[0]!.name;
  }
});

$effect(() => {
  if (needsAgentSelection && acpAgents.length > 0 && !selectedAgentId) {
    selectedAgentId = acpAgents[0]!.id;
  }
});

const canCreate = $derived(
  !!selectedSandbox && prompt.trim() !== '' && effectiveAgentId !== '' && sandboxAgentSupportsAcp,
);

async function handleCreate(): Promise<void> {
  if (!canCreate || creating) return;
  creating = true;
  error = undefined;
  try {
    const session = await window.createAcpSession({
      sandboxName: selectedSandboxName,
      prompt: prompt.trim(),
      ...(effectiveAgentId && { agentId: effectiveAgentId }),
    });
    onclose();
    router.goto(`/acp-sessions/${encodeURIComponent(session.id)}`);
  } catch (err: unknown) {
    console.error('Failed to create ACP session', err);
    error = err instanceof Error ? err.message : String(err);
    creating = false;
  }
}
</script>

<Dialog title="New Agent Session" onclose={onclose}>
  {#snippet content()}
    <div class="w-full space-y-4">
      <p class="text-sm text-[var(--pd-content-card-text)] opacity-60">
        Select a sandbox and describe what you'd like the agent to do.
      </p>

      <div>
        <label for="sandbox-select" class="block my-2 text-sm font-bold text-[var(--pd-modal-text)]">Sandbox</label>
        {#if readySandboxes.length === 0}
          <p class="text-sm text-[var(--pd-content-card-text)] opacity-60">
            No ready sandboxes available. Create a sandbox first.
          </p>
        {:else}
          <Dropdown
            id="sandbox-select"
            bind:value={selectedSandboxName}
            options={readySandboxes.map(s => ({ label: s.name, value: s.name }))}
          />
        {/if}
      </div>

      <div>
        <label for="agent-select" class="block my-2 text-sm font-bold text-[var(--pd-modal-text)]">Agent</label>
        {#if needsAgentSelection}
          {#if acpAgents.length === 0}
            <p class="text-sm text-[var(--pd-content-card-text)] opacity-60">
              No ACP-capable agents available.
            </p>
          {:else}
            <Dropdown
              id="agent-select"
              bind:value={selectedAgentId}
              options={acpAgents.map(a => ({ label: a.name, value: a.id }))}
            />
          {/if}
        {:else}
          <p class="text-sm text-[var(--pd-content-card-text)]">
            {sandboxAgentInfo?.name ?? sandboxAgentId}
            <span class="opacity-60">(set by workspace)</span>
          </p>
          {#if !sandboxAgentSupportsAcp}
            <ErrorMessage error={`Agent "${sandboxAgentInfo?.name ?? sandboxAgentId}" does not support ACP sessions.`} />
          {/if}
        {/if}
      </div>

      <div>
        <label for="prompt-input" class="block my-2 text-sm font-bold text-[var(--pd-modal-text)]">Prompt</label>
        <Textarea
          id="prompt-input"
          bind:value={prompt}
          rows={5}
          placeholder="Describe what you'd like the agent to do..."
          class="bg-muted min-h-[100px] resize-none rounded-lg !text-sm dark:border-zinc-700"
        />
      </div>

      {#if error}
        <ErrorMessage {error} />
      {/if}
    </div>
  {/snippet}

  {#snippet buttons()}
    <Button type="link" onclick={onclose} disabled={creating}>Cancel</Button>
    <Button type="primary" inProgress={creating} disabled={!canCreate || creating} onclick={handleCreate}>
      Start Session
    </Button>
  {/snippet}
</Dialog>
