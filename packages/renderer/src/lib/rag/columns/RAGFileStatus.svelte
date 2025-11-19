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
  <div class="flex flex-col">
    <div
      class="text-sm"
      class:text-green-600={object.status === 'Indexed'}
      class:dark:text-green-400={object.status === 'Indexed'}
      class:text-yellow-600={object.status === 'Pending'}
      class:dark:text-yellow-400={object.status === 'Pending'}>
      {object.status}
    </div>
  </div>
</div>
