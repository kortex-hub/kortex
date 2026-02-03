<script lang="ts">
import { NavPage, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';

import { ragEnvironments } from '/@/stores/rag-environments';
import type { RagEnvironment } from '/@api/rag/rag-environment';

import RAGEnvironmentActions from './columns/RAGEnvironmentActions.svelte';
import RAGEnvironmentChunker from './columns/RAGEnvironmentChunker.svelte';
import RAGEnvironmentDatabase from './columns/RAGEnvironmentDatabase.svelte';
import RAGEnvironmentName from './columns/RAGEnvironmentName.svelte';
import RAGEnvironmentSources from './columns/RAGEnvironmentSources.svelte';
import RAGEnvironmentStatus from './columns/RAGEnvironmentStatus.svelte';
import EmptyRAGEnvironmentScreen from './components/EmptyRAGEnvironmentScreen.svelte';

type RAGEnvironmentSelectable = RagEnvironment & { selected: boolean };

const row = new TableRow<RAGEnvironmentSelectable>({
  selectable: (_): boolean => false,
});

const statusColumn = new TableColumn<RAGEnvironmentSelectable>('Status', {
  width: '60px',
  renderer: RAGEnvironmentStatus,
});

const nameColumn = new TableColumn<RAGEnvironmentSelectable>('Environment Name', {
  width: '2fr',
  renderer: RAGEnvironmentName,
});

const databaseColumn = new TableColumn<RAGEnvironmentSelectable>('Database', {
  width: '1.5fr',
  renderer: RAGEnvironmentDatabase,
});

const chunkerColumn = new TableColumn<RAGEnvironmentSelectable>('Chunker', {
  width: '1.5fr',
  renderer: RAGEnvironmentChunker,
});

const sourcesColumn = new TableColumn<RAGEnvironmentSelectable>('Sources', {
  width: '80px',
  renderer: RAGEnvironmentSources,
});

const actionsColumn = new TableColumn<RAGEnvironmentSelectable>('Actions', {
  width: '120px',
  renderer: RAGEnvironmentActions,
});

const columns = [statusColumn, nameColumn, databaseColumn, chunkerColumn, sourcesColumn, actionsColumn];

function key(env: RAGEnvironmentSelectable): string {
  return env.name;
}
</script>

<NavPage searchEnabled={false} title="Knowledge Bases">
  {#snippet content()}
    <div class="w-full flex justify-center">
      {#if $ragEnvironments.length === 0}
        <EmptyRAGEnvironmentScreen />
      {:else}
        <Table
          kind="rag-environments"
          data={$ragEnvironments.map((env) => ({ ...env, selected: false }))}
          columns={columns}
          row={row}
          defaultSortColumn="Environment Name"
          key={key}
        />
      {/if}
    </div>
  {/snippet}
</NavPage>
