<script lang="ts">
import { faTrash } from '@fortawesome/free-solid-svg-icons';

import { withConfirmation } from '/@/lib/dialogs/messagebox-utils';
import ListItemButtonIcon from '/@/lib/ui/ListItemButtonIcon.svelte';
import type { SecretVaultInfo } from '/@api/secret-vault/secret-vault-info';

interface Props {
  object: SecretVaultInfo;
}

let { object }: Props = $props();

function handleRemove(): void {
  withConfirmation(() => window.removeSecret(object.id).catch(console.error), `remove secret ${object.name}`);
}
</script>

<ListItemButtonIcon
  title="Remove secret"
  icon={faTrash}
  onClick={handleRemove} />
