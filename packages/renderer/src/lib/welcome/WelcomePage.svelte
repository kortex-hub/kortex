<script lang="ts">
import { Button, Checkbox, Link } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';
import { router } from 'tinro';

import { onboardingList } from '/@/stores/onboarding';
import { providerInfos } from '/@/stores/providers';
import type { OnboardingInfo } from '/@api/onboarding';

import DesktopIcon from '../images/DesktopIcon.svelte';
import bgImage from './background.png';
import { WelcomeUtils } from './welcome-utils';

export let showWelcome = false;
export let showTelemetry = false;

let telemetry = true;

const welcomeUtils = new WelcomeUtils();
let podmanDesktopVersion: string;

// Extend ProviderInfo to have a selected property
interface OnboardingInfoWithAdditionalInfo extends OnboardingInfo {
  selected?: boolean;
  containerEngine?: boolean;
}

let onboardingProviders: OnboardingInfoWithAdditionalInfo[] = [];

// Get every provider that has a container connections
$: providersWithContainerConnections = $providerInfos.filter(provider => provider.containerConnections.length > 0);

// Using providerInfos as well as the information we have from onboarding,
// we will by default auto-select as well as add containerEngine to the list as true/false
// so we can make sure that extensions with container engines are listed first
$: onboardingProviders = $onboardingList
  .map(provider => {
    // Check if it's in the list, if it is, then it has a container engine
    const hasContainerConnection = providersWithContainerConnections.some(
      connectionProvider => connectionProvider.extensionId === provider.extension,
    );
    return {
      ...provider,
      selected: true,
      containerEngine: hasContainerConnection,
    };
  })
  .sort((a, b) => Number(b.containerEngine) - Number(a.containerEngine)); // Sort by containerEngine (true first)

onMount(async () => {
  const ver = await welcomeUtils.getVersion();
  if (!ver) {
    await welcomeUtils.updateVersion('initial');
    showWelcome = true;
  }
  router.goto('/');

  const telemetryPrompt = await welcomeUtils.havePromptedForTelemetry();
  if (!telemetryPrompt) {
    showTelemetry = true;
  }
  podmanDesktopVersion = await window.getPodmanDesktopVersion();

  if (showWelcome) {
    await window.updateConfigurationValue(`releaseNotesBanner.show`, podmanDesktopVersion);
  }
});

async function closeWelcome(): Promise<void> {
  showWelcome = false;
  if (showTelemetry) {
    await welcomeUtils.setTelemetry(telemetry);
  }
}

function startOnboardingQueue(): void {
  const selectedProviders = onboardingProviders.filter(provider => provider.selected);
  const extensionIds = selectedProviders.map(provider => provider.extension);
  const queryParams = new URLSearchParams({ ids: extensionIds.join(',') }).toString();
  router.goto(`/global-onboarding?${queryParams}`);
}
</script>

{#if showWelcome}
  <div
    class="flex flex-col flex-auto fixed top-0 left-0 right-0 bottom-0 bg-[var(--pd-content-card-bg)] bg-no-repeat z-50"
    style="background-image: url({bgImage}); background-position: 50% -175%; background-size: 100% 75%">
    <!-- Header -->
    <div class="flex flex-row flex-none backdrop-blur-sm p-6 mt-10">
      <div class="flex flex-auto text-lg font-bold">Get started with Kortex</div>
    </div>

    <!-- Body -->
    <div class="flex flex-col justify-center content-center flex-auto backdrop-blur-sm p-2 overflow-y-auto">
      <div class="flex justify-center p-2"><DesktopIcon /></div>
      <div class="flex justify-center text-lg font-bold p-2">
        <span class="mr-2">🎉</span>Welcome to Kortex v{podmanDesktopVersion} !
      </div>
    </div>

    <!-- Telemetry -->
    {#if showTelemetry}
      <div class="flex flex-col justify-end flex-none p-4">
        <div class="flex flex-row justify-center items-start p-1 text-sm">
          <Checkbox
            id="toggle-telemetry"
            bind:checked={telemetry}
            name="Enable telemetry"
            class="text-lg px-2"
            title="Enable telemetry"><div class="text-base font-medium">Telemetry:</div></Checkbox>
          <div class="w-2/5 text-[var(--pd-content-card-text)]">
            Help Red Hat improve Kortex by allowing anonymous usage data to be collected.
            <Link
              on:click={async (): Promise<void> => {
                await window.openExternal('https://developers.redhat.com/article/tool-data-collection');
              }}>Read our privacy statement</Link>
          </div>
        </div>
        <div class="flex justify-center p-1 text-sm text-[var(--pd-content-card-text)]">
          <div>
            You can always modify this preference later in Settings &gt; Preferences
          </div>
        </div>
      </div>
    {/if}

    <!-- Footer - button bar -->
    <div class="flex justify-end flex-none bg-[var(--pd-content-bg)] p-8">
      <div class="flex flex-row">
        <!-- If Providers have any onboarding elements selected, create a button that says "Start onboarding" rather than Skip -->
        {#if onboardingProviders && onboardingProviders.filter(o => o.selected).length > 0}
          <!-- We will "always" show the "Skip" button
          in-case anything were to happen with the Start onboarding button / sequence not working correctly.
          we do not want the user to not be able to continue. -->
          <Button
            type="secondary"
            on:click={closeWelcome}>Skip</Button>
          <Button
            class="ml-2"
            on:click={async (): Promise<void> => {
              await closeWelcome();
              startOnboardingQueue();
            }}>Start onboarding</Button>
        {:else}
          <Button
            on:click={closeWelcome}>Skip</Button>
        {/if}
      </div>
    </div>
  </div>
{/if}
