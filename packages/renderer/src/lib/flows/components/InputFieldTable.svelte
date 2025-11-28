<script lang="ts">
import { Table, TableColumn, TableRow, TableSimpleColumn } from '@podman-desktop/ui-svelte';

import type { InputField } from '../types/input-field';
import InputFieldActionsColumn from './InputFieldActionsColumn.svelte';
import InputFieldNameColumn from './InputFieldNameColumn.svelte';

interface Props {
  parameters: InputField[];
  onEdit: (index: number, field: InputField) => void;
  onDelete: (index: number, field: InputField) => void;
}

let { parameters, onEdit, onDelete }: Props = $props();

// Create data type that includes callbacks
interface ParameterWithCallbacks extends InputField {
  index: number;
  onEdit: (index: number, field: InputField) => void;
  onDelete: (index: number, field: InputField) => void;
}

// Add index and callbacks to each parameter for the table
const parametersWithCallbacks = $derived<ParameterWithCallbacks[]>(
  parameters.map((param, index) => ({
    ...param,
    index,
    onEdit,
    onDelete,
  })),
);

// Column 1: Description (Name + Description)
const descriptionColumn = new TableColumn<ParameterWithCallbacks>('Description', {
  width: '3fr',
  renderer: InputFieldNameColumn,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

// Column 2: Default Value
const defaultValueColumn = new TableColumn<ParameterWithCallbacks, string>('Default Value', {
  width: '2fr',
  renderer: TableSimpleColumn,
  renderMapping: (param): string => param.default ?? '-',
  comparator: (a, b): number => (a.default ?? '').localeCompare(b.default ?? ''),
});

// Column 3: Required
const RequiredColumn = new TableColumn<ParameterWithCallbacks, string>('Required', {
  width: '2fr',
  renderer: TableSimpleColumn,
  renderMapping: (param): string => (param.required ? 'Required' : 'Not Required'),
  comparator: (a, b): number => (a.required === b.required ? 0 : a.required ? -1 : 1),
});

// Column 4: Type (always "Text" for now)
const typeColumn = new TableColumn<ParameterWithCallbacks, string>('Type', {
  width: '2fr',
  renderer: TableSimpleColumn,
  renderMapping: (): string => 'Text',
  comparator: (): number => 0, // All types are the same
});

// Column 5: Actions (Edit and Delete buttons)
const actionsColumn = new TableColumn<ParameterWithCallbacks>('Actions', {
  align: 'right',
  width: '150px',
  renderer: InputFieldActionsColumn,
  overflow: true,
});

const columns = [descriptionColumn, defaultValueColumn, RequiredColumn, typeColumn, actionsColumn];

const row = new TableRow<ParameterWithCallbacks>({});
</script>

{#if parametersWithCallbacks.length > 0}
  <Table
    kind="parameter"
    data={parametersWithCallbacks}
    {columns}
    {row}
    defaultSortColumn="Description"
  />
{:else}
  <div class="w-full text-center py-8">
    No input fields defined yet. Click "Add Input Field" to create one.
  </div>
{/if}
