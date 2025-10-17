<script lang="ts">
import { NavPage, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';

import { ragEnvironments } from '/@/stores/rag-environments';

import RAGIcon from '../images/RAGIcon.svelte';
import RAGFilePath from './columns/RAGFilePath.svelte';
import RAGFileStatus from './columns/RAGFileStatus.svelte';
import { getChunkProviderName, getDatabaseName } from '/@/lib/rag/rag-environment-utils.svelte';
import { providerInfos } from '/@/stores/providers';
import { chunkProviders } from '/@/stores/chunk-providers';

interface Props {
  name: string;
}
let { name }: Props = $props();

interface FileWithStatus {
  path: string;
  status: 'Indexed' | 'Pending';
}

const ragEnvironment = $derived($ragEnvironments.find(env => env.name === decodeURIComponent(name)));

const files = $derived.by(() => {
  if (!ragEnvironment) return [];

  const indexedFiles: FileWithStatus[] = ragEnvironment.indexedFiles.map(path => ({
    path,
    status: 'Indexed' as const,
  }));

  const pendingFiles: FileWithStatus[] = ragEnvironment.pendingFiles.map(path => ({
    path,
    status: 'Pending' as const,
  }));

  return [...indexedFiles, ...pendingFiles];
});

const statusColumn = new TableColumn<FileWithStatus>('Status', {
  width: '100px',
  renderer: RAGFileStatus,
});

const pathColumn = new TableColumn<FileWithStatus>('File Path', {
  width: '3fr',
  renderer: RAGFilePath,
});

const columns = [statusColumn, pathColumn];

const row = new TableRow<FileWithStatus>({
  selectable: (_): boolean => false,
});

function key(file: FileWithStatus): string {
  return file.path;
}

const databaseName = $derived(getDatabaseName($providerInfos, ragEnvironment));
const chunkProviderName = $derived(getChunkProviderName($chunkProviders, ragEnvironment));
</script>

{#if ragEnvironment}
  <NavPage searchEnabled={false} title={ragEnvironment.name}>
    {#snippet content()}
      <div class="flex flex-col w-full h-full">
        <div class="flex flex-col p-5 gap-4 bg-[var(--pd-content-card-bg)] border-b border-[var(--pd-content-divider)]">
          <div class="flex items-center gap-3">
            <RAGIcon size={32} />
            <div class="flex flex-col">
              <div class="text-lg font-semibold text-[var(--pd-content-text)]">{ragEnvironment.name}</div>
              <div class="text-sm text-[var(--pd-content-text-secondary)]">
                RAG Connection: {databaseName} | Chunker: {chunkProviderName}
              </div>
            </div>
          </div>
          <div class="flex gap-6">
            <span class="text-sm">
              <span class="font-medium text-[var(--pd-content-text)]">Indexed Files:</span>
              <span class="text-[var(--pd-content-text-secondary)]"> {ragEnvironment.indexedFiles.length}</span>
            </span>
            <span class="text-sm">
              <span class="font-medium text-[var(--pd-content-text)]">Pending Files:</span>
              <span class="text-[var(--pd-content-text-secondary)]"> {ragEnvironment.pendingFiles.length}</span>
            </span>
            <span class="text-sm">
              <span class="font-medium text-[var(--pd-content-text)]">Total Files:</span>
              <span class="text-[var(--pd-content-text-secondary)]"> {ragEnvironment.indexedFiles.length + ragEnvironment.pendingFiles.length}</span>
            </span>
          </div>
        </div>
        <div class="flex flex-col w-full flex-1 overflow-auto">
          {#if files.length > 0}
            <Table
              kind="rag-environment-files"
              data={files}
              columns={columns}
              defaultSortColumn="Status"
              row={row}
              key={key}
            />
          {:else}
            <div class="flex items-center justify-center h-full">
              <div class="text-sm text-[var(--pd-content-text-secondary)]">No files in this RAG environment.</div>
            </div>
          {/if}
        </div>
      </div>
    {/snippet}
  </NavPage>
{:else}
  <div class="flex items-center justify-center h-full">
    <div class="text-sm text-[var(--pd-content-text-secondary)]">RAG environment not found.</div>
  </div>
{/if}
