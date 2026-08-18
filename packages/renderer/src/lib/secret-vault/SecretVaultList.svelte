<script lang="ts">
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import {
  Button,
  Dropdown,
  EmptyScreen,
  FilteredEmptyScreen,
  NavPage,
  SearchInput,
  Table,
  TableColumn,
  TableRow,
} from '@podman-desktop/ui-svelte';

import NoLogIcon from '/@/lib/ui/NoLogIcon.svelte';
import { handleNavigation } from '/@/navigation';
import { openshellGateways } from '/@/stores/openshell-gateways';
import {
  filteredSecretVaultInfos,
  secretVaultSearchPattern,
  selectedGateway as secretVaultSelectedGateway,
} from '/@/stores/secret-vault';
import { NavigationPage } from '/@api/navigation-page';
import type { SecretVaultInfo } from '/@api/secret-vault/secret-vault-info';

import SecretVaultAccount from './columns/SecretVaultAccount.svelte';
import SecretVaultActions from './columns/SecretVaultActions.svelte';
import SecretVaultIntegration from './columns/SecretVaultIntegration.svelte';
import SecretVaultMaskedSecret from './columns/SecretVaultMaskedSecret.svelte';
import SecretVaultEmptyScreen from './SecretVaultEmptyScreen.svelte';

type SecretVaultSelectable = SecretVaultInfo & { selected: boolean };

let searchTerm = $state('');
let gatewayFilter = $state('');

$effect(() => {
  secretVaultSearchPattern.set(searchTerm);
});

// Clear gateway filter when the selected gateway is no longer available
$effect(() => {
  const gateways = $openshellGateways;
  if (gateways.length < 2 || (gatewayFilter && !gateways.some(g => g.name === gatewayFilter))) {
    gatewayFilter = '';
  }
});

$effect(() => {
  secretVaultSelectedGateway.set(gatewayFilter);
});

const gatewayOptions = $derived.by(() => {
  const options: { label: string; value: string }[] = [{ label: 'All', value: '' }];
  for (const gateway of $openshellGateways) {
    options.push({ label: gateway.name, value: gateway.name });
  }
  return options;
});

const longestGatewayLabel = $derived(
  gatewayOptions.reduce((longest, option) => (option.label.length > longest.length ? option.label : longest), ''),
);

const row = new TableRow<SecretVaultSelectable>({});

const integrationColumn = new TableColumn<SecretVaultSelectable>('Integration', {
  width: '3fr',
  renderer: SecretVaultIntegration,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

const accountColumn = new TableColumn<SecretVaultSelectable>('Account', {
  width: '2fr',
  renderer: SecretVaultAccount,
  comparator: (): number => 0,
});

const secretColumn = new TableColumn<SecretVaultSelectable>('Secret', {
  width: '1fr',
  renderer: SecretVaultMaskedSecret,
});

const actionsColumn = new TableColumn<SecretVaultSelectable>('', {
  align: 'right',
  width: '40px',
  renderer: SecretVaultActions,
  overflow: true,
});

const columns = [integrationColumn, accountColumn, secretColumn, actionsColumn];

const secrets: SecretVaultSelectable[] = $derived(
  $filteredSecretVaultInfos.map(secret => ({ ...secret, selected: false })),
);

function addSecret(): void {
  handleNavigation({ page: NavigationPage.SECRET_VAULT_CREATE });
}

function clearGatewayFilter(): void {
  gatewayFilter = '';
}
</script>

<NavPage bind:searchTerm={searchTerm} searchEnabled={false} title="Secret Vault">
  {#snippet additionalActions()}
    <Button icon={faPlus} onclick={addSecret}>
      Add Secret
    </Button>
  {/snippet}

  {#snippet content()}
    <div class="flex flex-col min-w-full h-full">
      <div class="px-5 pt-4 pb-4">
        <div class="flex flex-row items-center gap-3">
          <div class="w-72">
            <SearchInput bind:searchTerm={searchTerm} title="Secret Vault" />
          </div>
          {#if $openshellGateways.length > 1}
            <div class="inline-grid max-w-64">
              <div class="invisible col-start-1 row-start-1 flex items-center px-1 py-1 whitespace-nowrap" aria-hidden="true">
                <span class="mr-1">Gateway:</span>
                <span class="truncate">{longestGatewayLabel}</span>
                <span class="w-4 shrink-0"></span>
              </div>
              <Dropdown
                ariaLabel="Filter by gateway"
                id="gateway-filter"
                name="gateway-filter"
                class="col-start-1 row-start-1 whitespace-nowrap grow-0!"
                bind:value={gatewayFilter}
                options={gatewayOptions}>
                {#snippet left()}
                  <div class="mr-1 text-(--pd-input-field-placeholder-text)">Gateway:</div>
                {/snippet}
              </Dropdown>
            </div>
          {/if}
        </div>
      </div>

      <div class="flex min-w-full min-h-0 flex-1 overflow-auto">
        {#if secrets.length === 0}
          {#if searchTerm}
            <FilteredEmptyScreen icon={NoLogIcon} kind="secrets" bind:searchTerm={searchTerm} />
          {:else if gatewayFilter}
            <EmptyScreen
              icon={NoLogIcon}
              title="No secrets on gateway '{gatewayFilter}'"
              message="This gateway has no secrets yet. Add one or select a different gateway.">
              <Button type="link" onclick={clearGatewayFilter}>Show all gateways</Button>
            </EmptyScreen>
          {:else}
            <SecretVaultEmptyScreen onclick={addSecret} />
          {/if}
        {:else}
          <Table
            kind="secret-vault"
            data={secrets}
            columns={columns}
            row={row}
            defaultSortColumn="Integration"
          />
        {/if}
      </div>
    </div>
  {/snippet}
</NavPage>
