<script lang="ts">
interface Props {
  label: string;
  value: string;
  title?: string;
  truncate?: boolean;
}

let { label, value, title, truncate = false }: Props = $props();
</script>

<div class="flex justify-between py-3">
  <span class="text-sm text-[var(--pd-content-card-text)]">{label}</span>
  <span
    class="text-sm font-medium text-[var(--pd-content-text)]"
    class:max-w-[200px]={truncate}
    class:text-right={truncate}
    class:truncate={truncate}
    title={title}>
    {value}
  </span>
</div>
