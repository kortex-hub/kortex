<script lang="ts">
import { onMount } from 'svelte';

import loaderEyes from './loader-eyes.png';
import loaderHead from './loader-head.png';
import loaderShadow1 from './loader-shadow1.png';
import loaderShadow2 from './loader-shadow2.png';

// Animation timing constants (in seconds for CSS, milliseconds for JS)
const ROTATION_DURATION_S = 40;
const FLOAT_DURATION_S = 4;
const BLINK_FADE_IN_S = 0.05;
const BLINK_FADE_OUT_S = 0.15;
const BLINK_CLOSE_DELAY_MS = 80;
const BLINK_MIN_INTERVAL_MS = 500;
const BLINK_RANDOM_INTERVAL_MS = 2_000;
const BLINK_INITIAL_MIN_DELAY_MS = 1_500;
const BLINK_INITIAL_RANDOM_DELAY_MS = 1_000;

// Design constants (based on 800pt original design)
const BASE_DESIGN_SIZE = 800;
const NUM_DOTS = 110;
const BASE_RADIUS = 394;
const BASE_DOT_RADIUS = 5;
const BASE_CLIP_RADIUS = 295;
const BASE_FLOAT_X = 40;
const BASE_FLOAT_Y = -20;
const DOTS_SCALE = 0.7;

// Color constants
const DOT_COLOR = '#cb5839';
const BACKGROUND_COLOR = '#962f2f';

interface Props {
  size?: number;
}

let { size = 400 }: Props = $props();

let dotsGroup: SVGGElement | undefined = $state();
let eyesElement: SVGUseElement | undefined = $state();

// Reactive dot creation - regenerates when size or dotsGroup changes
$effect(() => {
  if (dotsGroup) {
    // Clear existing dots
    // eslint-disable-next-line svelte/no-dom-manipulating
    dotsGroup.innerHTML = '';

    // Scale from 800pt design
    const scale = size / BASE_DESIGN_SIZE;
    const radius = BASE_RADIUS * scale;
    const dotRadius = BASE_DOT_RADIUS * scale;

    for (let i = 0; i < NUM_DOTS; i++) {
      const angle = (i * 2 * Math.PI) / NUM_DOTS;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

      circle.setAttribute('cx', (radius * Math.cos(angle)).toFixed(2));
      circle.setAttribute('cy', (radius * Math.sin(angle)).toFixed(2));
      circle.setAttribute('r', dotRadius.toString());
      circle.setAttribute('fill', DOT_COLOR);

      // eslint-disable-next-line svelte/no-dom-manipulating
      dotsGroup.appendChild(circle);
    }
  }
});

function blink(timeoutIds: ReturnType<typeof setTimeout>[]): void {
  if (eyesElement) {
    eyesElement.style.transition = `opacity ${BLINK_FADE_IN_S}s ease-in`;
    eyesElement.style.opacity = '1';

    timeoutIds.push(
      setTimeout(() => {
        if (eyesElement) {
          eyesElement.style.transition = `opacity ${BLINK_FADE_OUT_S}s ease-out`;
          eyesElement.style.opacity = '0';
        }
      }, BLINK_CLOSE_DELAY_MS),
    );

    // eslint-disable-next-line sonarjs/pseudo-random
    timeoutIds.push(
      setTimeout(() => blink(timeoutIds), BLINK_MIN_INTERVAL_MS + Math.random() * BLINK_RANDOM_INTERVAL_MS),
    );
  }
}

onMount(() => {
  const timeoutIds: ReturnType<typeof setTimeout>[] = [];

  // eslint-disable-next-line sonarjs/pseudo-random
  timeoutIds.push(
    setTimeout(() => blink(timeoutIds), BLINK_INITIAL_MIN_DELAY_MS + Math.random() * BLINK_INITIAL_RANDOM_DELAY_MS),
  );

  // Cleanup function - clear all timeouts when component is destroyed
  return (): void => {
    timeoutIds.forEach(id => clearTimeout(id));
  };
});
</script>

<div role="status">
  <span class="sr-only">Loading</span>
  <svg width={size} height={size} viewBox="0 0 {size} {size}"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink" color-interpolation-filters="sRGB"
      aria-hidden="true"
      style="--center: {size / 2}px; --float-x: {size * BASE_FLOAT_X / BASE_DESIGN_SIZE}px; --float-y: {size * BASE_FLOAT_Y / BASE_DESIGN_SIZE}px; --rotation-duration: {ROTATION_DURATION_S}s; --float-duration: {FLOAT_DURATION_S}s; --dots-scale: {DOTS_SCALE};">
    <style>
        @keyframes rotateDots {
            to { transform: translate(var(--center), var(--center)) scale(var(--dots-scale)) rotate(360deg); }
        }

        @keyframes floatHead {
            50% { transform: translate(var(--float-x), var(--float-y)); }
        }

        @keyframes fadeShadow1 {
            50% { opacity: 0.0; }
        }

        @keyframes fadeShadow2 {
            50% { opacity: 0.5; }
        }

        #dots {
            animation: rotateDots var(--rotation-duration) linear infinite;
            transform-origin: 0 0;
        }

        #headGroup {
            animation: floatHead var(--float-duration) ease-in-out infinite;
        }

        #shadow1Element {
            animation: fadeShadow1 var(--float-duration) ease-in-out infinite reverse;
            opacity: 0.5;
        }

        #shadow2Element {
            animation: fadeShadow2 var(--float-duration) ease-in-out infinite;
            opacity: 0;
        }
    </style>
    <defs>
        <clipPath id="backgroundClip">
            <circle cx={size / 2} cy={size / 2} r={size * BASE_CLIP_RADIUS / BASE_DESIGN_SIZE}/>
        </clipPath>

        <image id="shadow1" xlink:href={loaderShadow1} width={size} height={size}/>
        <image id="shadow2" xlink:href={loaderShadow2} width={size} height={size}/>
        <image id="head" xlink:href={loaderHead} width={size} height={size}/>
        <image id="eyes" xlink:href={loaderEyes} width={size} height={size}/>
    </defs>

    <circle cx={size / 2} cy={size / 2} r={size * BASE_CLIP_RADIUS / BASE_DESIGN_SIZE} fill={BACKGROUND_COLOR} stroke="none"/>

    <g id="dots" bind:this={dotsGroup} transform="translate({size / 2}, {size / 2}) scale({DOTS_SCALE})"></g>

    <g clip-path="url(#backgroundClip)">
        <use id="shadow1Element" xlink:href="#shadow1" style="mix-blend-mode: soft-light;"/>
        <use id="shadow2Element" xlink:href="#shadow2" style="mix-blend-mode: soft-light;"/>
    </g>

    <g id="headGroup">
        <use xlink:href="#head"/>
        <use id="eyesElement" bind:this={eyesElement} xlink:href="#eyes" style="opacity: 0;"/>
    </g>
  </svg>
</div>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
