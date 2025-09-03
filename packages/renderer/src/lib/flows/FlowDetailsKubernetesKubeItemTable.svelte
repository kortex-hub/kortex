<script lang="ts">
import type { KubernetesObject } from '@kubernetes/client-node';
import type { TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import { Table } from '@podman-desktop/ui-svelte';
import { onDestroy, onMount, type Snippet } from 'svelte';
import { writable } from 'svelte/store';

import { listenResources } from '/@/lib/kube/resources-listen';
import type { KubernetesObjectUI } from '/@/lib/objects/KubernetesObjectUI';
import type { IDisposable } from '/@api/disposable.js';

export interface Kind {
  resource: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformer: (o: KubernetesObject) => KubernetesObjectUI;
  delete: (name: string) => Promise<void>;
  isResource: (o: KubernetesObject) => boolean;
  filterResource: (o: KubernetesObject) => boolean;
}

interface Props {
  kinds: Kind[];
  singular: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: TableColumn<any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: TableRow<any>;

  emptySnippet: Snippet;
}

let started = $state<boolean>(false);

let { kinds, singular, columns, row, emptySnippet }: Props = $props();

let resources = $state<{ [key: string]: KubernetesObject[] | undefined }>({});
let resourceListeners: (IDisposable | undefined)[] = [];

const objects = $derived(
  kinds.flatMap(
    kind => resources[kind.resource]?.filter(kind.filterResource).map(object => kind.transformer(object)) ?? [],
  ),
);

onMount(async () => {
  for (const kind of kinds) {
    resourceListeners.push(
      await listenResources(
        kind.resource,
        {
          searchTermStore: writable<string>(),
        },
        (updatedResources: KubernetesObject[]) => {
          started = true;
          resources[kind.resource] = updatedResources;
        },
      ),
    );
  }
});

onDestroy(() => {
  for (const resourceListener of resourceListeners) {
    resourceListener?.dispose();
  }
});
</script>

<div class="flex min-w-full h-full">
  <Table
    kind={singular}
    data={objects}
    columns={columns}
    row={row}
    defaultSortColumn="Name">
  </Table>

  {#if started && objects.length === 0}
    {@render emptySnippet()}
  {/if}
</div>
