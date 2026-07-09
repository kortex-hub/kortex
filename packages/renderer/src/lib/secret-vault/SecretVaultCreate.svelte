<script lang="ts">
import { faChevronDown, faChevronUp, faGear, faKey } from '@fortawesome/free-solid-svg-icons';
import { Button, ErrorMessage, Input } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';
import { onMount } from 'svelte';

import type { CardSelectorOption } from '/@/lib/ui/CardSelector.svelte';
import CardSelector from '/@/lib/ui/CardSelector.svelte';
import FormPage from '/@/lib/ui/FormPage.svelte';
import PasswordInput from '/@/lib/ui/PasswordInput.svelte';
import { handleNavigation } from '/@/navigation';
import { NavigationPage } from '/@api/navigation-page';
import type { OpenshellProfile } from '/@api/openshell-gateway-info';
import type { SecretCreateOptions, SecretValue } from '/@api/secret-info';

import { getServiceIcon, OTHER_TYPE } from './secret-vault-utils';

let services = $state<OpenshellProfile[]>([]);
let loading = $state(true);

let type = $state(OTHER_TYPE);
let name = $state('');
let secret = $state('');
let description = $state('');
let hostPattern = $state('');
let pathPattern = $state('');
let headerName = $state('Authorization');
let valueFormat = $state('');
let injectionOpen = $state(true);
let saving = $state(false);
let error = $state('');
let credentialValues = $state<Record<string, string>>({});

let serviceMap = $derived(new Map(services.map(s => [s.id, s])));

let typeOptions = $derived<CardSelectorOption[]>([
  ...services.map(s => ({
    title: s.display_name,
    badge: s.display_name,
    value: s.id,
    icon: getServiceIcon(s.id),
  })),
  {
    title: 'Other',
    badge: 'Custom',
    value: OTHER_TYPE,
    icon: faKey,
    description: 'Custom secret with configurable injection',
  },
]);

let effectiveType = $derived(type || OTHER_TYPE);
let isOther = $derived(!serviceMap.has(effectiveType));
let selectedProfile = $derived(serviceMap.get(effectiveType));

$effect(() => {
  effectiveType;
  credentialValues = {};
});

function formatCredentialLabel(credName: string): string {
  return credName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatCredentialPlaceholder(credName: string): string {
  return `Enter ${credName.replace(/_/g, ' ')}`;
}

let title = $derived.by(() => {
  if (isOther) return 'Other Secret';
  if (!selectedProfile) return 'Other Secret';
  return `${selectedProfile.display_name} Secret`;
});

let subtitle = $derived.by(() => {
  if (isOther) return 'Configure a custom secret to inject as a header into matching requests.';
  return selectedProfile?.description ?? '';
});

let canSave = $derived.by(() => {
  if (loading) return false;
  if (!name.trim()) return false;
  if (isOther) {
    if (!secret.trim() || !hostPattern.trim() || !headerName.trim()) return false;
  } else {
    const creds = selectedProfile?.credentials ?? [];
    const requiredFilled = creds.filter(c => c.required).every(c => credentialValues[c.name]?.trim());
    if (!requiredFilled) return false;
  }
  return true;
});

onMount(async () => {
  try {
    services = (await window.listSecretServices()).filter(s => s.credentials?.length);
  } catch (err: unknown) {
    console.error('Failed to load secret services', err);
  } finally {
    loading = false;
  }
});

function cancel(): void {
  handleNavigation({ page: NavigationPage.SECRET_VAULT });
}

function toggleInjection(): void {
  injectionOpen = !injectionOpen;
}

async function addSecret(): Promise<void> {
  if (!canSave) return;
  saving = true;
  error = '';
  try {
    let value: string | SecretValue;

    if (isOther) {
      value = secret;
    } else {
      const creds = selectedProfile?.credentials ?? [];
      value = {
        credentials: Object.fromEntries(
          creds
            .filter(c => credentialValues[c.name]?.trim())
            .flatMap(c => {
              const val = credentialValues[c.name]!.trim();
              const keys = c.env_vars?.length ? c.env_vars : [c.name];
              return keys.map(k => [k, val]);
            }),
        ),
      };
    }

    const options: SecretCreateOptions = {
      name: name.trim(),
      type: effectiveType,
      value,
    };

    if (isOther) {
      if (description.trim()) {
        options.description = description.trim();
      }
      options.hosts = [hostPattern.trim()];
      options.header = headerName.trim();
      if (pathPattern.trim()) {
        options.path = pathPattern.trim();
      }
      if (valueFormat.trim()) {
        options.headerTemplate = valueFormat.trim().replace(/(?<!\$)\{value\}/g, '${value}');
      }
    }

    await window.createSecret(options);
    handleNavigation({ page: NavigationPage.SECRET_VAULT });
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : String(err);
  } finally {
    saving = false;
  }
}
</script>

<FormPage title="Add Secret">
  {#snippet content()}
    <div class="px-5 pb-5 min-w-full">
      <div class="bg-(--pd-content-card-bg) py-6">
        <div class="flex flex-col px-6 max-w-4xl mx-auto space-y-5">

          {#if loading}
            <p class="text-sm text-(--pd-content-card-text) opacity-70">Loading secret types…</p>
          {:else}
            <CardSelector
              label="Secret type"
              options={typeOptions}
              bind:selected={type}
            />
          {/if}

          <div>
            <h1 class="text-2xl font-bold text-(--pd-modal-text)">{title}</h1>
            <p class="text-sm text-(--pd-content-card-text) opacity-70 mt-2">{subtitle}</p>
          </div>

          <div>
            <span class="block text-sm font-semibold text-(--pd-modal-text) mb-2">Name</span>
            <Input bind:value={name} placeholder="e.g. GitHub Token" aria-label="Name" />
          </div>

          {#if isOther}
            <div>
              <span class="block text-sm font-semibold text-(--pd-modal-text) mb-2">Secret value</span>
              <PasswordInput
                bind:password={secret}
                placeholder="Enter secret value"
                aria-label="Secret value"
              />
              <p class="text-xs text-(--pd-content-card-text) opacity-60 mt-1.5">
                Encrypted at rest. You won't be able to view this value again.
              </p>
            </div>

            <div>
              <span class="block text-sm font-semibold text-(--pd-modal-text) mb-2">
                Description
                <span class="font-normal text-(--pd-content-card-text) opacity-60">(optional)</span>
              </span>
              <Input bind:value={description} placeholder="What this secret is used for" aria-label="Description" />
            </div>
          {:else if selectedProfile?.credentials}
            {#each selectedProfile.credentials as credential (credential.name)}
              <div>
                <span class="block text-sm font-semibold text-(--pd-modal-text) mb-2">
                  {formatCredentialLabel(credential.name)} {#if credential.description}({credential.description}){/if}
                  {#if !credential.required}
                    <span class="font-normal text-(--pd-content-card-text) opacity-60">(optional)</span>
                  {/if}
                </span>
                <PasswordInput
                  bind:password={credentialValues[credential.name]}
                  placeholder={formatCredentialPlaceholder(credential.name)}
                  aria-label={formatCredentialLabel(credential.name)}
                />
              </div>
            {/each}
          {/if}

          {#if isOther}
            <div>
              <span class="block text-sm font-semibold text-(--pd-modal-text) mb-2">Host pattern</span>
              <Input bind:value={hostPattern} placeholder="e.g. api.example.com or *.example.com" aria-label="Host pattern" />
              <p class="text-xs text-(--pd-content-card-text) opacity-60 mt-1.5">
                The host this secret applies to. Use *.example.com for wildcard subdomains.
              </p>
            </div>

            <div class="rounded-lg border border-(--pd-content-card-border) overflow-hidden">
              <button
                type="button"
                class="w-full flex items-center gap-3 px-4 py-3 bg-(--pd-content-card-inset-bg)
                  hover:bg-(--pd-content-card-hover-inset-bg) cursor-pointer"
                aria-expanded={injectionOpen}
                aria-controls="injection-settings"
                onclick={toggleInjection}
              >
                <Icon icon={faGear} size="sm" />
                <span class="text-sm font-semibold text-(--pd-modal-text) flex-1 text-left">Injection settings</span>
                <Icon icon={injectionOpen ? faChevronUp : faChevronDown} size="sm" />
              </button>

              {#if injectionOpen}
                <div id="injection-settings" class="px-4 pb-4 pt-2 space-y-4 bg-(--pd-content-card-inset-bg)">
                  <div>
                    <span class="block text-sm font-semibold text-(--pd-modal-text) mb-2">Header name</span>
                    <Input bind:value={headerName} placeholder="Authorization" aria-label="Header name" />
                  </div>

                  <div>
                    <span class="block text-sm font-semibold text-(--pd-modal-text) mb-2">
                      Value format
                      <span class="font-normal text-(--pd-content-card-text) opacity-60">(optional)</span>
                    </span>
                    <Input bind:value={valueFormat} placeholder="Bearer {'{value}'}" aria-label="Value format" />
                    <p class="text-xs text-(--pd-content-card-text) opacity-60 mt-1.5">
                      Use {'{value}'} as a placeholder for the secret. Defaults to the raw value.
                    </p>
                  </div>

                  <div>
                    <span class="block text-sm font-semibold text-(--pd-modal-text) mb-2">
                      Path pattern
                      <span class="font-normal text-(--pd-content-card-text) opacity-60">(optional)</span>
                    </span>
                    <Input bind:value={pathPattern} placeholder="e.g. /v1/*" aria-label="Path pattern" />
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          {#if error}
            <ErrorMessage error={error} />
          {/if}

          <div class="flex items-center justify-end gap-3 pt-4 border-t border-(--pd-content-card-border)">
            <Button onclick={cancel}>Cancel</Button>
            <Button disabled={!canSave || saving} onclick={addSecret}>
              {saving ? 'Adding...' : 'Add Secret'}
            </Button>
          </div>

        </div>
      </div>
    </div>
  {/snippet}
</FormPage>
