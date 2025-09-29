<script lang="ts" generics="T extends { name?: string }">
import type { TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import { Button,Table } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';

import type { PaginationStore } from '/@/stores/pagination/pagination-store';

interface Props {
  store: PaginationStore<T>;
  kind: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: Array<TableColumn<T, any>>;
  row: TableRow<T>;
  defaultSortColumn?: string;
  loading: boolean;
  scrollToTop: () => void;
}

let { kind, store, columns, row, defaultSortColumn, loading = $bindable(), scrollToTop }: Props = $props();

let hasNext: boolean = $state(false);

onMount(() => {
  store.subscribe(() => {
    hasNext = store.hasNext();
  });
  store.init().catch(console.error).finally(() => {
    loading = false;
  });
});

function nextPage(): void {
  loading = true;
  store.next().then(() => {
    scrollToTop();
  }).catch(console.error).finally(() => {
    loading = false;
  });
}
</script>

<div class="flex w-full">
  <Table
    kind={kind}
    data={$store}
    columns={columns}
    row={row}
    defaultSortColumn={defaultSortColumn}>
  </Table>
</div>

<div class="flex justify-center pb-4">
  <Button inProgress={loading} onclick={nextPage} disabled={!hasNext || loading}>Next</Button>
</div>


