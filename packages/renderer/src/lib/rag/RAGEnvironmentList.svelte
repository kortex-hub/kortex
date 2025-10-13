<script lang="ts">
import { NavPage, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';

import { ragEnvironments } from '/@/stores/rag-environments';
import type { RagEnvironment } from '/@api/rag/rag-environment';

import RAGIcon from '../images/RAGIcon.svelte';
import RAGEnvironmentName from './columns/RAGEnvironmentName.svelte';
import EmptyRAGEnvironmentScreen from './components/EmptyRAGEnvironmentScreen.svelte';

type RAGEnvironmentSelectable = RagEnvironment & { selected: boolean };

const row = new TableRow<RAGEnvironmentSelectable>({
  selectable: (_): boolean => false,
});

const itemColumn = new TableColumn<RAGEnvironmentSelectable>('icon', {
  width: '40px',
  renderer: RAGIcon,
});

const nameColumn = new TableColumn<RAGEnvironmentSelectable>('Name', {
  width: '2fr',
  renderer: RAGEnvironmentName,
});

const ragConnectionColumn = new TableColumn<RAGEnvironmentSelectable>('RAG Connection ID', {
  width: '1.5fr',
  renderText: (env): string => env.ragConnectionId,
});

const chunkerColumn = new TableColumn<RAGEnvironmentSelectable>('Chunker ID', {
  width: '1.5fr',
  renderText: (env): string => env.chunkerId,
});

const indexedFilesColumn = new TableColumn<RAGEnvironmentSelectable>('Indexed Files', {
  width: '1fr',
  renderText: (env): string => env.indexedFiles.length.toString(),
});

const pendingFilesColumn = new TableColumn<RAGEnvironmentSelectable>('Pending Files', {
  width: '1fr',
  renderText: (env): string => env.pendingFiles.length.toString(),
});

const columns = [itemColumn, nameColumn, ragConnectionColumn, chunkerColumn, indexedFilesColumn, pendingFilesColumn];

function key(env: RAGEnvironmentSelectable): string {
  return env.name;
}
</script>

<NavPage searchEnabled={false} title="RAG Environments">
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
          defaultSortColumn="Name"
          key={key}
        />
      {/if}
    </div>
  {/snippet}
</NavPage>
