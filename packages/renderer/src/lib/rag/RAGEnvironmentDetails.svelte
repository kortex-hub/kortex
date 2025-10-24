<script lang="ts">
import { TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';

import { getChunkProviderName, getDatabaseName } from '/@/lib/rag/rag-environment-utils.svelte';
import { chunkProviders } from '/@/stores/chunk-providers';
import { providerInfos } from '/@/stores/providers';
import { ragEnvironments } from '/@/stores/rag-environments';

import RAGIcon from '../images/RAGIcon.svelte';
import RAGFilePath from './columns/RAGFilePath.svelte';
import RAGFileStatus from './columns/RAGFileStatus.svelte';

interface Props {
  name: string;
}
let { name }: Props = $props();

interface FileWithStatus {
  path: string;
  status: 'Indexed' | 'Pending';
}

type TabType = 'summary' | 'sources' | 'vectorstore' | 'chunker';

let activeTab = $state<TabType>('summary');

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

const databaseName = $derived(getDatabaseName($providerInfos, ragEnvironment));
const chunkProviderName = $derived(getChunkProviderName($chunkProviders, ragEnvironment));

function goBack(): void {
  router.goto('/rag');
}

function setTab(tab: TabType): void {
  activeTab = tab;
}

async function handleAddFile(): Promise<void> {
  if (!ragEnvironment) return;

  try {
    const selectedFiles = await window.openDialog({
      title: 'Select file to add to RAG environment',
      selectors: ['openFile'],
    });

    if (selectedFiles && selectedFiles.length > 0) {
      const filePath = selectedFiles[0];
      const result = await window.addFileToPendingFiles(ragEnvironment.name, filePath);

      if (!result) {
        console.error('Failed to add file to RAG environment');
      }
    }
  } catch (error: unknown) {
    console.error('Error selecting file:', error);
  }
}
</script>

{#if ragEnvironment}
  <div class="flex flex-col h-full bg-[var(--pd-content-bg)]">
    <!-- Details Header -->
    <div class="details-header mb-0 px-6 py-4 border-b border-[var(--pd-content-divider)] bg-[var(--pd-content-card-bg)] relative">
      <!-- Close Button -->
      <button
        class="close-button absolute top-4 right-6 bg-transparent border-0 text-[var(--pd-content-text-secondary)] cursor-pointer p-2 rounded hover:text-[var(--pd-content-text)] hover:bg-[var(--pd-content-card-inset-bg)] transition-all duration-200"
        onclick={goBack}
        title="Close"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <!-- Breadcrumb Navigation -->
      <div class="breadcrumb-nav flex items-center gap-2 mb-3 text-sm">
        <button onclick={goBack} class="breadcrumb-link text-[var(--pd-link)] no-underline hover:text-[var(--pd-link-hover)] transition-colors duration-200 bg-transparent border-0 cursor-pointer">
          Knowledges
        </button>
        <span class="breadcrumb-separator text-[var(--pd-content-text-muted)]">></span>
        <span class="breadcrumb-current text-[var(--pd-content-text)]">Knowledge Details</span>
      </div>

      <!-- Environment Header -->
      <div class="environment-header flex items-center justify-between">
        <div class="environment-info flex items-center gap-4">
          <div class="environment-icon w-8 h-8 bg-[var(--pd-content-card-inset-bg)] rounded-md flex items-center justify-center text-[var(--pd-content-text-secondary)]">
            <RAGIcon size={16} />
          </div>
          <div class="environment-details">
            <h2 class="text-lg font-semibold text-[var(--pd-content-text)] m-0 mb-1">{ragEnvironment.name}</h2>
            <div class="environment-subtitle text-xs text-[var(--pd-content-text-secondary)]">
              <span>Running</span> • <span>{databaseName} + {chunkProviderName}</span>
            </div>
          </div>
        </div>

        <div class="environment-actions flex items-center gap-2">
          <button
            class="header-action-button inline-flex items-center justify-center w-8 h-8 border-0 rounded-md bg-[var(--pd-button-primary)] text-white cursor-pointer hover:bg-[var(--pd-button-primary-hover)] transition-all duration-200"
            title="Stop"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
          </button>
          <button
            class="header-action-button inline-flex items-center justify-center w-8 h-8 border-0 rounded-md bg-[var(--pd-content-card-inset-bg)] text-[var(--pd-content-text-secondary)] cursor-pointer hover:bg-[color-mix(in_srgb,var(--pd-status-error)_10%,transparent)] hover:text-[var(--pd-status-error)] transition-all duration-200"
            title="Delete"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19,6v14a2,2 0,0,1-2,2H7a2,2 0,0,1-2-2V6m3,0V4a2,2 0,0,1,2-2h4a2,2 0,0,1,2,2v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="details-tabs flex border-b border-[var(--pd-content-divider)] mb-8 px-6">
      <button
        class="details-tab px-4 py-3 text-[var(--pd-content-text-secondary)] text-sm font-medium border-b-2 border-transparent hover:text-[var(--pd-content-text)] transition-all duration-200 bg-transparent cursor-pointer {activeTab === 'summary' ? 'active text-white border-[var(--pd-button-primary)]' : ''}"
        onclick={() => setTab('summary')}
      >
        Summary
      </button>
      <button
        class="details-tab px-4 py-3 text-[var(--pd-content-text-secondary)] text-sm font-medium border-b-2 border-transparent hover:text-[var(--pd-content-text)] transition-all duration-200 bg-transparent cursor-pointer {activeTab === 'sources' ? 'active text-white border-[var(--pd-button-primary)]' : ''}"
        onclick={() => setTab('sources')}
      >
        Sources
      </button>
      <button
        class="details-tab px-4 py-3 text-[var(--pd-content-text-secondary)] text-sm font-medium border-b-2 border-transparent hover:text-[var(--pd-content-text)] transition-all duration-200 bg-transparent cursor-pointer {activeTab === 'vectorstore' ? 'active text-white border-[var(--pd-button-primary)]' : ''}"
        onclick={() => setTab('vectorstore')}
      >
        VectorStore
      </button>
      <button
        class="details-tab px-4 py-3 text-[var(--pd-content-text-secondary)] text-sm font-medium border-b-2 border-transparent hover:text-[var(--pd-content-text)] transition-all duration-200 bg-transparent cursor-pointer {activeTab === 'chunker' ? 'active text-white border-[var(--pd-button-primary)]' : ''}"
        onclick={() => setTab('chunker')}
      >
        Chunker
      </button>
    </div>

    <!-- Tab Content -->
    <div class="px-6 pb-6 overflow-auto flex-1">
      {#if activeTab === 'summary'}
        <!-- Summary Tab -->
        <div class="summary-grid grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6 mb-8">
          <div class="info-card bg-[var(--pd-content-card-bg)] border border-[var(--pd-content-divider)] rounded-lg p-5">
            <h3 class="info-card-title text-sm font-semibold text-[var(--pd-content-text-secondary)] mb-4 uppercase tracking-wider">General Information</h3>
            <div class="info-row flex justify-between py-3 border-b border-[var(--pd-content-divider)]">
              <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Name</span>
              <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">{ragEnvironment.name}</span>
            </div>
            <div class="info-row flex justify-between py-3 border-b border-[var(--pd-content-divider)]">
              <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Status</span>
              <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">Running</span>
            </div>
            <div class="info-row flex justify-between py-3 border-b-0">
              <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Created</span>
              <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">-</span>
            </div>
          </div>

          <div class="info-card bg-[var(--pd-content-card-bg)] border border-[var(--pd-content-divider)] rounded-lg p-5">
            <h3 class="info-card-title text-sm font-semibold text-[var(--pd-content-text-secondary)] mb-4 uppercase tracking-wider">Configuration</h3>
            <div class="info-row flex justify-between py-3 border-b border-[var(--pd-content-divider)]">
              <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Vector Store</span>
              <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">{databaseName}</span>
            </div>
            <div class="info-row flex justify-between py-3 border-b border-[var(--pd-content-divider)]">
              <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Embedding Model</span>
              <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">{chunkProviderName}</span>
            </div>
            <div class="info-row flex justify-between py-3 border-b-0">
              <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Source Files</span>
              <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">{files.length} files</span>
            </div>
          </div>
        </div>
      {:else if activeTab === 'sources'}
        <!-- Sources Tab -->
        <div
          class="upload-area border-2 border-dashed border-[var(--pd-content-divider)] rounded-lg py-12 px-6 text-center cursor-pointer hover:border-[var(--pd-button-primary)] hover:bg-[color-mix(in_srgb,var(--pd-button-primary)_5%,transparent)] transition-all duration-200 mb-6"
          onclick={handleAddFile}
          role="button"
          tabindex="0"
        >
          <svg class="upload-icon w-12 h-12 mx-auto mb-4 text-[var(--pd-content-text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <div class="upload-text text-base text-[var(--pd-content-text)] mb-2">Drop files here or click to upload</div>
          <div class="upload-subtext text-sm text-[var(--pd-content-text-secondary)]">Supports PDF, TXT, MD, and more</div>
        </div>

        <div class="sources-list bg-[var(--pd-content-card-bg)] border border-[var(--pd-content-divider)] rounded-lg overflow-hidden">
          <div class="sources-header px-5 py-4 border-b border-[var(--pd-content-divider)] bg-[var(--pd-content-card-inset-bg)]">
            <h3 class="sources-title text-base font-semibold text-[var(--pd-content-text)]">Uploaded Files ({files.length})</h3>
          </div>

          {#if files.length > 0}
            {#each files as file}
              <div class="source-item flex items-center justify-between px-5 py-4 border-b border-[var(--pd-content-divider)] last:border-b-0 hover:bg-[var(--pd-content-card-inset-bg)] transition-colors duration-200">
                <div class="source-info flex items-center gap-3">
                  <div class="file-icon w-8 h-8 bg-[var(--pd-content-card-inset-bg)] rounded-md flex items-center justify-center text-[var(--pd-content-text-secondary)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                    </svg>
                  </div>
                  <div class="source-details">
                    <h4 class="text-sm font-medium text-[var(--pd-content-text)] m-0 mb-1">{file.path.split('/').pop() || file.path}</h4>
                    <div class="source-meta text-xs text-[var(--pd-content-text-secondary)]">{file.status}</div>
                  </div>
                </div>
                <div class="source-actions flex gap-2">
                  <button class="source-action w-7 h-7 border-0 rounded bg-transparent text-[var(--pd-content-text-secondary)] cursor-pointer flex items-center justify-center hover:bg-[var(--pd-content-card-inset-bg)] hover:text-[var(--pd-content-text)] transition-all duration-200" title="Download">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </button>
                  <button class="source-action w-7 h-7 border-0 rounded bg-transparent text-[var(--pd-content-text-secondary)] cursor-pointer flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--pd-status-error)_10%,transparent)] hover:text-[var(--pd-status-error)] transition-all duration-200" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="M19,6v14a2,2 0,0,1-2,2H7a2,2 0,0,1-2-2V6m3,0V4a2,2 0,0,1,2-2h4a2,2 0,0,1,2,2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
          {:else}
            <div class="flex items-center justify-center py-12">
              <div class="text-sm text-[var(--pd-content-text-secondary)]">No files in this RAG environment.</div>
            </div>
          {/if}
        </div>
      {:else if activeTab === 'vectorstore'}
        <!-- VectorStore Tab -->
        <div class="info-card bg-[var(--pd-content-card-bg)] border border-[var(--pd-content-divider)] rounded-lg p-5 max-w-2xl">
          <h3 class="info-card-title text-sm font-semibold text-[var(--pd-content-text-secondary)] mb-4 uppercase tracking-wider">{databaseName} Configuration</h3>
          <div class="info-row flex justify-between py-3 border-b border-[var(--pd-content-divider)]">
            <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Database Type</span>
            <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">{databaseName}</span>
          </div>
          <div class="info-row flex justify-between py-3 border-b border-[var(--pd-content-divider)]">
            <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Collection Name</span>
            <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">{ragEnvironment.name.replace(/[^a-zA-Z0-9_]/g, '_')}</span>
          </div>
          <div class="info-row flex justify-between py-3 border-b border-[var(--pd-content-divider)]">
            <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Vector Dimension</span>
            <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">768</span>
          </div>
          <div class="info-row flex justify-between py-3 border-b border-[var(--pd-content-divider)]">
            <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Index Type</span>
            <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">IVF_FLAT</span>
          </div>
          <div class="info-row flex justify-between py-3 border-b-0">
            <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Metric Type</span>
            <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">L2</span>
          </div>
        </div>
      {:else if activeTab === 'chunker'}
        <!-- Chunker Tab -->
        <div class="info-card bg-[var(--pd-content-card-bg)] border border-[var(--pd-content-divider)] rounded-lg p-5 max-w-2xl">
          <h3 class="info-card-title text-sm font-semibold text-[var(--pd-content-text-secondary)] mb-4 uppercase tracking-wider">{chunkProviderName} Configuration</h3>
          <div class="info-row flex justify-between py-3 border-b border-[var(--pd-content-divider)]">
            <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Model</span>
            <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">{chunkProviderName}</span>
          </div>
          <div class="info-row flex justify-between py-3 border-b border-[var(--pd-content-divider)]">
            <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Chunk Size</span>
            <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">512 tokens</span>
          </div>
          <div class="info-row flex justify-between py-3 border-b border-[var(--pd-content-divider)]">
            <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Chunk Overlap</span>
            <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">50 tokens</span>
          </div>
          <div class="info-row flex justify-between py-3 border-b-0">
            <span class="info-label text-sm text-[var(--pd-content-text-secondary)]">Embedding Dimension</span>
            <span class="info-value text-sm text-[var(--pd-content-text)] font-medium">768</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <div class="flex items-center justify-center h-full">
    <div class="text-sm text-[var(--pd-content-text-secondary)]">RAG environment not found.</div>
  </div>
{/if}
