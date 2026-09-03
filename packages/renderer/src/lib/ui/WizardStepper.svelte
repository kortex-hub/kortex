<script lang="ts">
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { Icon } from '@podman-desktop/ui-svelte/icons';

interface Step {
  id: string;
  title: string;
}

interface Props {
  steps: Step[];
  currentIndex: number;
  completedIds?: Set<string>;
  onStepClick?: (index: number) => void;
}

let { steps, currentIndex, completedIds, onStepClick }: Props = $props();

function getState(index: number): 'completed' | 'active' | 'upcoming' {
  const step = steps[index];
  if (completedIds !== undefined ? completedIds.has(step.id) : index < currentIndex) return 'completed';
  if (index === currentIndex) return 'active';
  return 'upcoming';
}

function handleClick(index: number): void {
  if (getState(index) !== 'upcoming' && onStepClick) {
    onStepClick(index);
  }
}
</script>

<nav class="flex items-center justify-center" aria-label="Wizard progress">
  {#each steps as step, index (step.id)}
    {@const state = getState(index)}
    {#if index > 0}
      <div
        class="h-0.5 w-12 mx-1 transition-colors {state === 'upcoming'
          ? 'bg-[var(--pd-content-divider)]'
          : 'bg-[var(--pd-button-primary-bg)]'}"
        aria-hidden="true">
      </div>
    {/if}
    <button
      class="flex flex-col items-center gap-1.5 min-w-[80px] transition-opacity
        {state === 'upcoming' ? 'opacity-50 cursor-default' : 'opacity-100 cursor-pointer'}"
      aria-label="{step.title} step"
      aria-current={index === currentIndex ? 'step' : undefined}
      disabled={state === 'upcoming'}
      onclick={():void => handleClick(index)}>
      <div
        class="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors
          {state === 'completed'
            ? 'bg-green-600 text-white'
            : state === 'active'
              ? 'bg-[var(--pd-button-primary-bg)] text-[var(--pd-button-text)]'
              : 'bg-[var(--pd-content-card-inset-bg)] text-[var(--pd-content-card-text)]'}">
        {#if state === 'completed'}
          <Icon icon={faCheck} size="0.8x" />
        {:else}
          {index + 1}
        {/if}
      </div>
      <span class="text-xs text-[var(--pd-content-card-text)] whitespace-nowrap">{step.title}</span>
    </button>
  {/each}
</nav>
