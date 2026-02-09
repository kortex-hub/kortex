<script lang="ts">
import { faBackward, faForward } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';

interface Props {
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled: boolean;
  nextDisabled: boolean;
  title: string;
}

const {
  onPrevious = (): void => {},
  onNext = (): void => {},
  previousDisabled = false,
  nextDisabled = false,
  title = '',
}: Props = $props();
</script>

<div class="flex items-center justify-center gap-4 py-2">
  <Button type="link"
    class="px-3 py-1 rounded hover:bg-[var(--pd-button-hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
    onclick={onPrevious}
    disabled={previousDisabled}
    aria-label="Previous page">
    <Icon icon={faBackward} />
  </Button>
  <span class="text-sm">
        {title}
      </span>
  <Button type="link"
    class="px-3 py-1 rounded hover:bg-[var(--pd-button-hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
    onclick={onNext}
    disabled={nextDisabled}
    aria-label="Next page">
    <Icon icon={faForward} />
  </Button>
</div>
