<script lang="ts">
import { faLock } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';
import { onMount } from 'svelte';
import { toast } from 'svelte-sonner';

import type { ModelInfo } from '/@/lib/chat/components/model-info';
import { agentDefinitions, matchesModelFilter } from '/@/lib/guided-setup/agent-registry';
import { getModelId } from '/@/lib/models/models-utils';
import type { ChecklistItem } from '/@/lib/ui/ChecklistPanel.svelte';
import FormPage from '/@/lib/ui/FormPage.svelte';
import WizardStepper from '/@/lib/ui/WizardStepper.svelte';
import { handleNavigation } from '/@/navigation';
import { resetDraft, wizard } from '/@/stores/agent-workspace-create-draft.svelte';
import { agentWorkspaceRuntime } from '/@/stores/agentworkspace-runtime';
import { mcpRemoteServerInfos } from '/@/stores/mcp-remote-servers';
import { disabledModels, isModelEnabled, modelKey } from '/@/stores/model-catalog';
import { catalogModels } from '/@/stores/models';
import { providerInfos } from '/@/stores/providers';
import { ragEnvironments } from '/@/stores/rag-environments';
import { skillInfos } from '/@/stores/skills';
import type {
  AgentWorkspaceConfiguration,
  AgentWorkspaceMount,
  NetworkConfiguration,
} from '/@api/agent-workspace-info';
import { NavigationPage } from '/@api/navigation-page';
import type { DefaultWorkspaceSettings } from '/@api/onboarding-settings-info';

import AgentWorkspaceCreateStepAgentModel from './AgentWorkspaceCreateStepAgentModel.svelte';
import type { CustomMount } from './AgentWorkspaceCreateStepFileSystem.svelte';
import AgentWorkspaceCreateStepFileSystem from './AgentWorkspaceCreateStepFileSystem.svelte';
import AgentWorkspaceCreateStepNetworking from './AgentWorkspaceCreateStepNetworking.svelte';
import AgentWorkspaceCreateStepToolsSecrets from './AgentWorkspaceCreateStepToolsSecrets.svelte';
import AgentWorkspaceCreateStepWorkspace from './AgentWorkspaceCreateStepWorkspace.svelte';

function mapNetworkSelection(value: string, hosts: string[]): NetworkConfiguration | undefined {
  const filtered = hosts.filter(h => h.trim() !== '');
  switch (value) {
    case 'open':
      return { mode: 'allow' };
    case 'registries':
    case 'blocked':
      return { mode: 'deny', hosts: filtered.length ? filtered : undefined };
    default:
      return undefined;
  }
}

const wizardSteps = [
  { id: 'workspace', title: 'Workspace' },
  { id: 'agent-model', title: 'Agent & Model' },
  { id: 'tools-secrets', title: 'Tools & Secrets' },
  { id: 'filesystem', title: 'File System' },
  { id: 'networking', title: 'Networking' },
];

let skillItems: ChecklistItem[] = $derived(
  $skillInfos
    .filter(s => s.enabled)
    .map(s => ({
      id: s.name,
      name: s.name,
      description: s.description,
      group: s.managed ? 'Custom' : 'Pre-built',
    })),
);
let mcpItems: ChecklistItem[] = $derived(
  $mcpRemoteServerInfos.map(m => ({ id: m.id, name: m.name, description: m.description })),
);
let knowledgeItems: ChecklistItem[] = $derived(
  $ragEnvironments
    .filter(r => r.mcpServer)
    .map(r => {
      const sourceCount = r.files.length;
      const sourcesLabel = sourceCount > 0 ? `${sourceCount} source${sourceCount !== 1 ? 's' : ''}` : '';
      const providerName =
        $providerInfos.find(p => p.id === r.ragConnection.providerId)?.name ?? r.ragConnection.providerId;
      return {
        id: r.name,
        name: r.name,
        description: [providerName, sourcesLabel].filter(Boolean).join(' · '),
      };
    }),
);

// --- Form state (backed by persistent draft store) ---
let defaultSettings = $state<DefaultWorkspaceSettings | undefined>(undefined);

onMount(async () => {
  defaultSettings = await window.getConfigurationValue<DefaultWorkspaceSettings>('onboarding.defaultWorkspaceSettings');

  if (!wizard.draft.initialized) {
    const defaultAgent = defaultSettings?.defaultAgent;
    if (defaultAgent && agentDefinitions.some(d => d.cliName === defaultAgent)) {
      wizard.draft.selectedAgent = defaultAgent;
    }

    if (
      defaultAgent &&
      defaultSettings?.defaultAgentSettings?.[defaultAgent]?.defaultModel?.providerId &&
      defaultSettings?.defaultAgentSettings?.[defaultAgent]?.defaultModel?.label
    ) {
      const allModels = $catalogModels;
      const match = allModels.find(
        m =>
          m.providerId === defaultSettings?.defaultAgentSettings?.[defaultAgent]?.defaultModel?.providerId &&
          m.label === defaultSettings?.defaultAgentSettings?.[defaultAgent]?.defaultModel?.label,
      );
      if (match) {
        wizard.draft.selectedModel = match;
      }
    }
    if (!wizard.draft.selectedModel) {
      const firstModel = getFirstCompatibleModel();
      if (firstModel) {
        wizard.draft.selectedModel = firstModel;
      }
    }

    wizard.draft.initialized = true;
  }
});
let customHosts = $derived(wizard.draft.hostsByMode[wizard.draft.selectedNetwork] ?? []);

function getDefaultSessionName(path: string): string {
  const normalized = path.trim().replace(/[\\/]+$/, '');
  return normalized.split(/[\\/]/).filter(Boolean).at(-1) ?? '';
}

$effect(() => {
  if (wizard.draft.nameManuallyEdited) return;
  const last = getDefaultSessionName(wizard.draft.sourcePath);
  if (last) wizard.draft.sessionName = last;
});

let configCheckToken = 0;

$effect(() => {
  const trimmed = wizard.draft.sourcePath.trim();
  const token = ++configCheckToken;
  if (trimmed) {
    window
      .checkAgentWorkspaceConfigExists(trimmed)
      .then(exists => {
        if (token === configCheckToken) {
          wizard.draft.configExists = exists;
        }
      })
      .catch(() => {
        if (token === configCheckToken) {
          wizard.draft.configExists = false;
        }
      });
  } else {
    wizard.draft.configExists = false;
  }
});

// --- Wizard navigation ---
let currentStepIndex = $derived(wizard.draft.currentStepIndex);
let error = $state('');

let currentStepId = $derived(wizardSteps[wizard.draft.currentStepIndex]?.id ?? '');
let isLastStep = $derived(wizard.draft.currentStepIndex === wizardSteps.length - 1);
let isCurrentStepComplete = $derived(
  currentStepId === 'workspace'
    ? wizard.draft.sessionName.trim() !== '' && wizard.draft.sourcePath.trim() !== ''
    : true,
);

function goNext(): void {
  if (wizard.draft.currentStepIndex < wizardSteps.length - 1) wizard.draft.currentStepIndex++;
}

function goBack(): void {
  if (wizard.draft.currentStepIndex > 0) wizard.draft.currentStepIndex--;
}

function handleStepClick(index: number): void {
  wizard.draft.currentStepIndex = index;
}

function addCustomMount(): void {
  wizard.draft.customMounts = [...wizard.draft.customMounts, { host: '', target: '', ro: false }];
}

function removeCustomMount(index: number): void {
  if (wizard.draft.customMounts.length <= 1) return;
  wizard.draft.customMounts = wizard.draft.customMounts.filter((_, i) => i !== index);
}

function updateCustomMount(index: number, field: keyof CustomMount, value: string | boolean): void {
  wizard.draft.customMounts = wizard.draft.customMounts.map((m, i) => (i === index ? { ...m, [field]: value } : m));
}

function addCustomHost(): void {
  const current = wizard.draft.hostsByMode[wizard.draft.selectedNetwork] ?? [];
  wizard.draft.hostsByMode = { ...wizard.draft.hostsByMode, [wizard.draft.selectedNetwork]: [...current, ''] };
}

function removeCustomHost(index: number): void {
  const current = wizard.draft.hostsByMode[wizard.draft.selectedNetwork] ?? [];
  if (current.length <= 1) return;
  wizard.draft.hostsByMode = {
    ...wizard.draft.hostsByMode,
    [wizard.draft.selectedNetwork]: current.filter((_, i) => i !== index),
  };
}

function updateCustomHost(index: number, value: string): void {
  const current = wizard.draft.hostsByMode[wizard.draft.selectedNetwork] ?? [];
  wizard.draft.hostsByMode = {
    ...wizard.draft.hostsByMode,
    [wizard.draft.selectedNetwork]: current.map((h, i) => (i === index ? value : h)),
  };
}

async function handleBrowseCustomPath(index: number): Promise<void> {
  try {
    const result = await window.openDialog({ title: 'Select a directory', selectors: ['openDirectory'] });
    const selected = result?.[0];
    if (selected) updateCustomMount(index, 'host', selected);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    error = message;
    toast.error(`Failed to browse for directory: ${message}`);
  }
}

async function handleBrowseSource(): Promise<void> {
  try {
    const result = await window.openDialog({ title: 'Select a working directory', selectors: ['openDirectory'] });
    const selected = result?.[0];
    if (selected) {
      wizard.draft.sourcePath = selected;
      if (!wizard.draft.nameManuallyEdited) {
        const lastSegment = getDefaultSessionName(selected);
        if (lastSegment) wizard.draft.sessionName = lastSegment;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    error = message;
    toast.error(`Failed to browse for directory: ${message}`);
  }
}

function cancel(): void {
  resetDraft();
  handleNavigation({ page: NavigationPage.AGENT_WORKSPACES });
}

function normalizeTildeToHome(p: string): string {
  return p.startsWith('~/') ? `$HOME/${p.slice(2)}` : p;
}

function getAgentWorkspaceConfiguration(agent: string): AgentWorkspaceConfiguration | undefined {
  const resolvedAgent = agentDefinitions.find(d => d.cliName === agent)?.cliAgent ?? agent;
  const config =
    defaultSettings?.defaultAgentSettings?.[resolvedAgent]?.workspaceConfiguration ??
    defaultSettings?.defaultAgentSettings?.[agent]?.workspaceConfiguration;
  if (!config) return undefined;
  const snapshot = $state.snapshot(config);
  if (snapshot.mounts) {
    snapshot.mounts = snapshot.mounts.map(m => ({
      ...m,
      host: normalizeTildeToHome(m.host),
      target: normalizeTildeToHome(m.target),
    }));
  }
  return snapshot;
}

function getFirstCompatibleModel(): ModelInfo | undefined {
  const agentDef = agentDefinitions.find(d => d.cliName === wizard.draft.selectedAgent);
  const enabled = $catalogModels.filter(m => isModelEnabled($disabledModels, m.providerId, m.label));
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const seen = new Set<string>();
  const unique = enabled.filter(m => {
    const key = modelKey(m.providerId, m.label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const compatible = agentDef?.modelFilter
    ? unique.filter(m => matchesModelFilter(agentDef.modelFilter!, m.llmMetadata?.name))
    : unique;
  return compatible[0];
}

function buildMountsFrom(fileAccess: string, mounts: CustomMount[]): AgentWorkspaceMount[] | undefined {
  switch (fileAccess) {
    case 'home':
      return [{ host: '$HOME', target: '$HOME', ro: false }];
    case 'full':
      return [{ host: '/', target: '/', ro: false }];
    case 'custom': {
      const filtered = mounts
        .filter(m => m.host.trim() !== '')
        .map(m => {
          const host = m.host.trim();
          const trimmedTarget = m.target.trim();
          const target = trimmedTarget !== '' ? trimmedTarget : host;
          return { host, target, ro: m.ro };
        });
      return filtered.length > 0 ? filtered : undefined;
    }
    default:
      return undefined;
  }
}

async function startAsIs(): Promise<void> {
  if (!wizard.draft.sourcePath.trim()) return;

  const draftSnapshot = $state.snapshot(wizard.draft);

  try {
    const agentDef = agentDefinitions.find(d => d.cliName === draftSnapshot.selectedAgent);
    await window.createAgentWorkspace({
      sourcePath: draftSnapshot.sourcePath,
      runtime: $agentWorkspaceRuntime,
      agent: agentDef?.cliAgent ?? draftSnapshot.selectedAgent,
      name: draftSnapshot.sessionName || getDefaultSessionName(draftSnapshot.sourcePath),
    });
    resetDraft();
  } catch (err: unknown) {
    console.error('Failed to create agent workspace (as-is)', err);
    window
      .showMessageBox({
        title: 'Agent Workspace',
        type: 'error',
        message: `Error while creating workspace: ${err instanceof Error ? err.message : String(err)}`,
        buttons: ['OK'],
      })
      .catch(console.error);
  } finally {
    handleNavigation({ page: NavigationPage.AGENT_WORKSPACES });
  }
}

async function startWorkspace(): Promise<void> {
  if (!wizard.draft.sessionName.trim() || !wizard.draft.sourcePath.trim()) return;

  const draftSnapshot = $state.snapshot(wizard.draft);

  try {
    const selectedSkillPaths = $skillInfos
      .filter(s => draftSnapshot.selectedSkillIds.includes(s.name))
      .map(s => s.path);
    const network = mapNetworkSelection(
      draftSnapshot.selectedNetwork,
      draftSnapshot.hostsByMode[draftSnapshot.selectedNetwork] ?? [],
    );
    const mounts = buildMountsFrom(draftSnapshot.selectedFileAccess, draftSnapshot.customMounts);

    const agentDef = agentDefinitions.find(d => d.cliName === draftSnapshot.selectedAgent);

    const selected = $mcpRemoteServerInfos.filter(m => draftSnapshot.selectedMcpIds.includes(m.id));
    const remoteServers = selected
      .filter(m => m.setupType === 'remote' || (!m.setupType && m.url))
      .map(m => ({ name: m.name, url: m.url }));
    const commandServers = selected
      .filter(m => m.setupType === 'package' && m.commandSpec)
      .map(m => ({
        name: m.name,
        command: m.commandSpec!.command,
        args: m.commandSpec!.args,
        env: m.commandSpec!.env,
      }));
    const hasMcp = remoteServers.length > 0 || commandServers.length > 0;

    await window.createAgentWorkspace({
      sourcePath: draftSnapshot.sourcePath,
      runtime: $agentWorkspaceRuntime,
      agent: agentDef?.cliAgent ?? draftSnapshot.selectedAgent,
      model: draftSnapshot.selectedModel ? getModelId(draftSnapshot.selectedModel) : undefined,
      name: draftSnapshot.sessionName,
      skills: selectedSkillPaths.length > 0 ? selectedSkillPaths : undefined,
      network,
      secrets: draftSnapshot.selectedSecretIds.length > 0 ? [...draftSnapshot.selectedSecretIds] : undefined,
      mounts,
      mcp: hasMcp
        ? {
            ...(remoteServers.length > 0 ? { servers: remoteServers } : {}),
            ...(commandServers.length > 0 ? { commands: commandServers } : {}),
          }
        : undefined,
      workspaceConfiguration: getAgentWorkspaceConfiguration(draftSnapshot.selectedAgent),
      replaceConfig: draftSnapshot.configExists && draftSnapshot.configAction === 'replace' ? true : undefined,
    });
    resetDraft();
  } catch (err: unknown) {
    console.error('Failed to create agent workspace', err);
    window
      .showMessageBox({
        title: 'Agent Workspace',
        type: 'error',
        message: `Error while creating workspace: ${err instanceof Error ? err.message : String(err)}`,
        buttons: ['OK'],
      })
      .catch(console.error);
  } finally {
    handleNavigation({ page: NavigationPage.AGENT_WORKSPACES });
  }
}
</script>

<FormPage title="Create Agent Workspace">
  {#snippet content()}
    <div class="px-5 pb-5 min-w-full">
      <div class="bg-[var(--pd-content-card-bg)] py-6">
        <div class="flex flex-col px-6 max-w-4xl mx-auto space-y-5">

          <!-- Page header -->
          <div class="mb-2">
            <span class="text-xs font-semibold uppercase tracking-widest text-[var(--pd-label-primary-text)] bg-[var(--pd-label-primary-bg)] px-2 py-0.5 rounded mb-2 inline-block">
              Coding Agent
            </span>
            <h1 class="text-2xl font-bold text-[var(--pd-modal-text)] mb-1">Create Coding Agent Workspace</h1>
            <p class="text-sm text-[var(--pd-content-card-text)] opacity-70 max-w-2xl leading-relaxed">
              Add your code location first, then agent, tools, and sandbox filesystem & networking.
            </p>
          </div>

          <!-- Stepper -->
          <WizardStepper steps={wizardSteps} currentIndex={currentStepIndex} onStepClick={handleStepClick} />

          <!-- Step content -->
          <div class="rounded-xl border border-[var(--pd-content-card-border)] bg-[var(--pd-content-card-inset-bg)] p-6">
            {#if currentStepId === 'workspace'}
              <AgentWorkspaceCreateStepWorkspace
                bind:sourcePath={wizard.draft.sourcePath}
                bind:sessionName={wizard.draft.sessionName}
                bind:description={wizard.draft.description}
                bind:nameManuallyEdited={wizard.draft.nameManuallyEdited}
                bind:descriptionOpen={wizard.draft.descriptionOpen}
                onBrowseSource={handleBrowseSource}
                configExists={wizard.draft.configExists}
                bind:configAction={wizard.draft.configAction}
                onStartAsIs={startAsIs} />
            {:else if currentStepId === 'agent-model'}
              <AgentWorkspaceCreateStepAgentModel bind:selectedAgent={wizard.draft.selectedAgent} bind:selectedModel={wizard.draft.selectedModel} />
            {:else if currentStepId === 'tools-secrets'}
              <AgentWorkspaceCreateStepToolsSecrets
                {skillItems}
                bind:selectedSkillIds={wizard.draft.selectedSkillIds}
                {mcpItems}
                bind:selectedMcpIds={wizard.draft.selectedMcpIds}
                bind:selectedSecretIds={wizard.draft.selectedSecretIds}
                {knowledgeItems}
                bind:selectedKnowledgeIds={wizard.draft.selectedKnowledgeIds} />
            {:else if currentStepId === 'filesystem'}
              <AgentWorkspaceCreateStepFileSystem
                bind:selectedFileAccess={wizard.draft.selectedFileAccess}
                customMounts={wizard.draft.customMounts}
                onBrowseCustomPath={handleBrowseCustomPath}
                onAddCustomMount={addCustomMount}
                onRemoveCustomMount={removeCustomMount}
                onUpdateCustomMount={updateCustomMount} />
            {:else if currentStepId === 'networking'}
              <AgentWorkspaceCreateStepNetworking
                bind:selectedNetwork={wizard.draft.selectedNetwork}
                customHosts={customHosts}
                onAddCustomHost={addCustomHost}
                onRemoveCustomHost={removeCustomHost}
                onUpdateCustomHost={updateCustomHost} />
            {/if}
          </div>

          {#if error}
            <div class="text-sm text-red-400 bg-red-900/20 rounded-lg p-3">{error}</div>
          {/if}

          <!-- Footer actions -->
          <div class="flex items-center justify-between pt-4 border-t border-[var(--pd-content-card-border)]">
            <div class="flex items-center gap-3 text-sm text-[var(--pd-content-card-text)] opacity-70">
              <Icon icon={faLock} size="sm" class="text-green-400" />
              <span>Step {currentStepIndex + 1} of {wizardSteps.length} · Workspace will run in a secured sandbox environment</span>
            </div>
            <div class="flex flex-wrap items-center justify-end gap-3">
              {#if currentStepIndex > 0}
                <Button onclick={goBack}>Back</Button>
              {/if}
              <Button onclick={cancel}>Cancel</Button>
              {#if currentStepId === 'workspace'}
                <Button type="secondary" disabled={!isCurrentStepComplete} onclick={startWorkspace}>
                  Use all defaults and create workspace
                </Button>
              {/if}
              {#if isLastStep}
                <Button onclick={startWorkspace}>
                  Start Workspace
                </Button>
              {:else}
                <Button disabled={!isCurrentStepComplete} onclick={goNext}>Continue</Button>
              {/if}
            </div>
          </div>

        </div>
      </div>
    </div>
  {/snippet}
</FormPage>
