<script lang="ts">
interface FileWithStatus {
  path: string;
  status: 'Indexed' | 'Pending';
}

interface Props {
  object: FileWithStatus;
}

const { object }: Props = $props();
</script>

<div class="flex flex-row items-center">
  <div class="flex flex-col overflow-hidden">
    <div class="text-sm text-[var(--pd-table-body-text)]" title={object.path}>
      {object.path}
    </div>
  </div>
</div>
