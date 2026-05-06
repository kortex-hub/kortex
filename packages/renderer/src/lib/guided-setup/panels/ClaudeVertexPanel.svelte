<script lang="ts">
import {
  faArrowUpRightFromSquare,
  faCircleCheck,
  faFolderOpen,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { Button, ErrorMessage, Input, Link } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';

import { fetchProviders, providerInfos } from '/@/stores/providers';

import type { AgentDefinition } from '../agent-registry';
import type { OnboardingState } from '../guided-setup-steps';

interface Props {
  definition?: AgentDefinition;
  onboarding?: OnboardingState;
}

let { definition, onboarding }: Props = $props();

function parseSelector(selector?: string): { extensionId: string; providerId: string } {
  const [extensionId = 'kaiden.vertex-ai', providerId = 'vertex-ai'] = (selector ?? 'kaiden.vertex-ai:vertex-ai').split(
    ':',
  );
  return { extensionId, providerId };
}

const { providerId } = $derived(parseSelector(definition?.providerSelector));

let projectId = $state('');
let region = $state('global');
let credentialsFile = $state('');
let errorMessage = $state('');

const KDN_VERTEX_README = 'https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude';

function openReadmeLink(): void {
  window.openExternal(KDN_VERTEX_README).catch(() => {});
}

let vertexProvider = $derived($providerInfos.find(p => p.id === providerId));

let existingConnection = $derived(vertexProvider?.inferenceConnections?.find(c => c.models.length > 0));
let alreadyConnected = $derived(!!existingConnection);

async function browseCredentialsFile(): Promise<void> {
  const result = await window.openDialog({
    title: 'Select Google Cloud credentials file',
    selectors: ['openFile'],
  });
  if (result?.[0]) {
    credentialsFile = result[0];
  }
}

async function validate(): Promise<boolean> {
  if (alreadyConnected) {
    return true;
  }

  errorMessage = '';

  if (!vertexProvider) {
    errorMessage = 'Vertex AI provider extension is not available. Make sure the Vertex AI extension is enabled.';
    return false;
  }

  if (!projectId.trim()) {
    errorMessage = 'Please enter your Google Cloud project ID.';
    return false;
  }

  if (!region.trim()) {
    errorMessage = 'Please enter a region (e.g. us-east5, europe-west1, global).';
    return false;
  }

  if (!credentialsFile.trim()) {
    errorMessage = 'Please provide the path to your gcloud credentials file.';
    return false;
  }

  try {
    const loggerKey = Symbol('onboarding-vertex-ai');
    const noop = (): void => {};
    await window.createInferenceProviderConnection(
      vertexProvider.internalId,
      {
        'vertex-ai.factory.projectId': projectId.trim(),
        'vertex-ai.factory.region': region.trim(),
        'vertex-ai.factory.credentialsFile': credentialsFile.trim(),
      },
      loggerKey,
      noop,
      undefined,
      undefined,
    );
    if (onboarding !== undefined) {
      const agentSettings = onboarding.workspaceSetting.defaultAgentSettings?.[onboarding.agent] ?? {};
      onboarding.workspaceSetting.defaultAgentSettings ??= {};
      onboarding.workspaceSetting.defaultAgentSettings[onboarding.agent] = agentSettings;
      agentSettings.workspaceConfiguration ??= {};
      agentSettings.workspaceConfiguration.environment ??= [];
      agentSettings.workspaceConfiguration.environment = agentSettings.workspaceConfiguration.environment.filter(
        e => e.name !== 'CLAUDE_CODE_USE_VERTEX',
      );
      agentSettings.workspaceConfiguration.environment.push({
        name: 'CLAUDE_CODE_USE_VERTEX',
        value: '1',
      });
      agentSettings.workspaceConfiguration.environment = agentSettings.workspaceConfiguration.environment.filter(
        e => e.name !== 'CLOUD_ML_REGION',
      );
      agentSettings.workspaceConfiguration.environment.push({
        name: 'CLOUD_ML_REGION',
        value: region.trim(),
      });
      agentSettings.workspaceConfiguration.environment = agentSettings.workspaceConfiguration.environment.filter(
        e => e.name !== 'ANTHROPIC_VERTEX_PROJECT_ID',
      );
      agentSettings.workspaceConfiguration.environment.push({
        name: 'ANTHROPIC_VERTEX_PROJECT_ID',
        value: projectId.trim(),
      });
      agentSettings.workspaceConfiguration.mounts ??= [];
      agentSettings.workspaceConfiguration.mounts = agentSettings.workspaceConfiguration.mounts.filter(
        e => e.target !== '$HOME/.config/gcloud/application_default_credentials.json',
      );
      agentSettings.workspaceConfiguration.mounts.push({
        host: credentialsFile.trim(),
        target: '$HOME/.config/gcloud/application_default_credentials.json',
        ro: true,
      });
    }

    await fetchProviders();

    return true;
  } catch (err: unknown) {
    errorMessage = err instanceof Error ? err.message : String(err);
    return false;
  }
}

$effect(() => {
  if (onboarding) {
    onboarding.beforeAdvance = validate;
  }
  return (): void => {
    if (onboarding?.beforeAdvance === validate) {
      onboarding.beforeAdvance = undefined;
    }
  };
});
</script>

<div
  class="rounded-xl border border-(--pd-content-divider) bg-(--pd-content-card-inset-bg) p-6"
  data-testid="claude-vertex-panel">

  {#if alreadyConnected}
    <div
      class="flex items-center gap-3 rounded-lg bg-(--pd-content-card-bg) border border-(--pd-state-success) p-4"
      role="status"
      aria-live="polite"
      data-testid="vertex-already-connected">
      <Icon icon={faCircleCheck} size="lg" class="text-(--pd-state-success)" />
      <div>
        <strong class="text-sm text-(--pd-state-success)">Connection configured</strong>
        <p class="text-xs text-(--pd-content-card-text) opacity-70 mt-0.5">
          {existingConnection?.models.length} model{existingConnection?.models.length !== 1 ? 's' : ''} available. You can continue to the next step.
        </p>
      </div>
    </div>
  {:else}
    <h3 class="text-xs font-bold uppercase tracking-wider text-(--pd-content-card-text) opacity-50 mb-3">
      Google Cloud Vertex AI
    </h3>
    <p class="text-xs text-(--pd-content-card-text) opacity-50 mb-4 leading-relaxed">
      Connect to Anthropic models on Google Cloud Vertex AI.
      Run <code class="font-mono">gcloud auth application-default login</code> on the host first.
    </p>

    <div class="flex flex-col gap-4" data-testid="claude-vertex-form">
      {#if !vertexProvider}
        <div
          class="flex items-center gap-2 rounded-lg bg-(--pd-content-card-bg) border border-(--pd-state-warning) p-3"
          role="alert"
          data-testid="vertex-provider-missing">
          <Icon icon={faTriangleExclamation} size="sm" class="text-(--pd-state-warning) shrink-0" />
          <span class="text-xs text-(--pd-state-warning)">Vertex AI provider extension not detected.</span>
        </div>
      {/if}

      <div class="flex flex-col gap-1.5">
        <label for="vertex-project-id" class="text-xs font-medium text-(--pd-content-card-text)">
          Google Cloud project ID
        </label>
        <Input
          id="vertex-project-id"
          placeholder="my-gcp-project-id"
          bind:value={projectId}
          disabled={!vertexProvider}
          aria-label="Google Cloud project ID" />
        <span class="text-[10px] text-(--pd-content-card-text) opacity-40">
          The project where Anthropic models are enabled (not the ADC quota_project_id).
        </span>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="vertex-region" class="text-xs font-medium text-(--pd-content-card-text)">
          Region
        </label>
        <Input
          id="vertex-region"
          placeholder="us-east5"
          bind:value={region}
          disabled={!vertexProvider}
          aria-label="Region" />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="vertex-credentials" class="text-xs font-medium text-(--pd-content-card-text)">
          Credentials file
        </label>
        <div class="flex flex-row grow space-x-1.5">
          <Input
            id="vertex-credentials"
            placeholder="~/.config/gcloud/application_default_credentials.json"
            bind:value={credentialsFile}
            disabled={!vertexProvider}
            aria-label="Credentials file" />
          <Button
            type="secondary"
            aria-label="Browse credentials file"
            icon={faFolderOpen}
            disabled={!vertexProvider}
            onclick={browseCredentialsFile} />
        </div>
        <span class="text-[10px] text-(--pd-content-card-text) opacity-40">
          Path to your gcloud application default credentials file.
        </span>
      </div>

      {#if errorMessage}
        <ErrorMessage error={errorMessage} />
      {/if}

      <div class="pt-1">
        <Link class="flex flex-row w-fit items-center" on:click={openReadmeLink}>
          <Icon class="ml-1 self-center" icon={faArrowUpRightFromSquare} />&nbsp;Vertex AI documentation
        </Link>
      </div>
    </div>
  {/if}
</div>
