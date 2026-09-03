<script lang="ts">
import { Button, Tooltip } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { router } from 'tinro';

import { providerInfos } from '/@/stores/providers';
import type { CheckStatus, ProviderInfo } from '/@api/provider-info';

import PreferencesProviderInstallationModal from './PreferencesProviderInstallationModal.svelte';

let {
  provider,
  providerDisplayName,
  buttonTitle,
  preflightChecks = $bindable(),
}: {
  provider: ProviderInfo;
  providerDisplayName: string;
  buttonTitle: string;

  preflightChecks: CheckStatus[];
} = $props();

let providerInstallationInProgress = new SvelteMap<string, boolean>();
let displayInstallModal = $state(false);
let providerToBeInstalled = $state<{ provider: ProviderInfo; displayName: string }>();
let doExecuteAfterInstallation: () => void;

onMount(() => {
  $providerInfos.forEach(provider => {
    if (
      providerToBeInstalled &&
      doExecuteAfterInstallation &&
      provider.name === providerToBeInstalled.provider.name &&
      (provider.status === 'ready' || provider.status === 'installed')
    ) {
      providerToBeInstalled = undefined;
      doExecuteAfterInstallation();
    }
  });
});

async function doCreateNew(provider: ProviderInfo, displayName: string): Promise<void> {
  displayInstallModal = false;
  if (provider.status === 'not-installed') {
    providerInstallationInProgress.set(provider.name, true);
    providerToBeInstalled = { provider, displayName };
    doExecuteAfterInstallation = (): void => router.goto(`/preferences/provider/${provider.internalId}`);
    await performInstallation(provider);
  } else {
    await window.telemetryTrack('createNewProviderConnectionPageRequested', {
      providerId: provider.id,
      name: provider.name,
    });
    router.goto(`/preferences/provider/${provider.internalId}`);
  }
}

async function performInstallation(provider: ProviderInfo): Promise<void> {
  const checksStatus: CheckStatus[] = [];
  let checkSuccess = false;
  let currentCheck: CheckStatus;
  try {
    checkSuccess = await window.runInstallPreflightChecks(provider.internalId, {
      endCheck: status => {
        if (currentCheck) {
          currentCheck = status;
        } else {
          return;
        }
        if (currentCheck.successful === false) {
          checksStatus.push(currentCheck);
          preflightChecks = checksStatus;
        }
      },
      startCheck: status => {
        currentCheck = status;
        if (currentCheck.successful === false) {
          preflightChecks = [...checksStatus, currentCheck];
        }
      },
    });
  } catch (err) {
    console.error(err);
  }
  if (checkSuccess) {
    await window.installProvider(provider.internalId);
    // reset checks
    preflightChecks = [];
  } else {
    displayInstallModal = true;
  }
  providerInstallationInProgress.set(provider.name, false);
}

function hideInstallModal(): void {
  displayInstallModal = false;
}
</script>

<Tooltip bottom tip="Create new {providerDisplayName}">
  <Button
    aria-label="Create new {providerDisplayName}"
    inProgress={providerInstallationInProgress.get(provider.name)}
    onclick={(): Promise<void> => doCreateNew(provider, providerDisplayName)}>
    {buttonTitle} ...
  </Button>
</Tooltip>

{#if displayInstallModal && providerToBeInstalled}
  <PreferencesProviderInstallationModal
    providerToBeInstalled={providerToBeInstalled}
    preflightChecks={preflightChecks}
    closeCallback={hideInstallModal}
    doCreateNew={doCreateNew} />
{/if}
