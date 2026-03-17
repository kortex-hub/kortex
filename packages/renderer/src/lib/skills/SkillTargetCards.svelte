<script lang="ts">
import { faClaude } from '@fortawesome/free-brands-svg-icons';
import { faBoxOpen } from '@fortawesome/free-solid-svg-icons';

import CardSelector from '/@/lib/ui/CardSelector.svelte';
import type { SkillTarget } from '/@api/skill/skill-info';

interface Props {
  selected?: SkillTarget;
}

let { selected = $bindable('kortex') }: Props = $props();

const options = [
  { title: 'Kortex Skills', badge: 'Kortex', value: 'kortex', icon: faBoxOpen },
  { title: 'Claude Skills', badge: 'Claude', value: 'claude', icon: faClaude },
];
</script>

<CardSelector label="Target" {options} bind:selected />
