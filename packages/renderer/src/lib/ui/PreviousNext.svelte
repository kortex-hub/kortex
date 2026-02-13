<script lang="ts">
import { faBackward, faForward } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';

interface Props {
  onPrevious: () => void;
  onNext: () => void;
  currentPage: number;
  totalPages: number;
}

const { onPrevious = (): void => {}, onNext = (): void => {}, currentPage, totalPages }: Props = $props();
</script>

<div class="flex items-center justify-center gap-4 py-2">
  <Button type="link"
    class="px-3 py-1 rounded hover:bg-[var(--pd-button-hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
    onclick={onPrevious}
    disabled={currentPage === 0}
    aria-label="Previous page">
    <Icon icon={faBackward} />
  </Button>
  <span class="text-sm">
        Page {currentPage + 1} of {totalPages}
      </span>
  <Button type="link"
    class="px-3 py-1 rounded hover:bg-[var(--pd-button-hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
    onclick={onNext}
    disabled={currentPage >= totalPages - 1}
    aria-label="Next page">
    <Icon icon={faForward} />
  </Button>
</div>
