/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import { render, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import LoaderAnimation from './LoaderAnimation.svelte';

beforeEach(() => {
  vi.clearAllTimers();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe('LoaderAnimation', () => {
  test('should render with default size', () => {
    const { container } = render(LoaderAnimation);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    expect(svg?.getAttribute('width')).toBe('400');
    expect(svg?.getAttribute('height')).toBe('400');
  });

  test('should render with custom size', () => {
    const { container } = render(LoaderAnimation, { props: { size: 200 } });
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    expect(svg?.getAttribute('width')).toBe('200');
    expect(svg?.getAttribute('height')).toBe('200');
  });

  test('should have role status for accessibility', () => {
    const { container } = render(LoaderAnimation);
    const statusElement = container.querySelector('[role="status"]');
    expect(statusElement).toBeDefined();
  });

  test('should have sr-only loading text', () => {
    const { getByText } = render(LoaderAnimation);
    const loadingText = getByText('Loading');
    expect(loadingText).toBeDefined();
    expect(loadingText.className).toContain('sr-only');
  });

  test('should create dots on mount', async () => {
    const { container } = render(LoaderAnimation);
    const dotsGroup = container.querySelector('#dots');
    expect(dotsGroup).toBeDefined();

    await waitFor(() => {
      const circles = dotsGroup?.querySelectorAll('circle');
      expect(circles?.length).toBe(110); // NUM_DOTS = 110
    });
  });

  test('should create dots with correct attributes', async () => {
    const { container } = render(LoaderAnimation);
    const dotsGroup = container.querySelector('#dots');

    await waitFor(() => {
      const circles = dotsGroup?.querySelectorAll('circle');
      expect(circles?.length).toBeGreaterThan(0);

      const firstCircle = circles?.[0];
      expect(firstCircle?.getAttribute('fill')).toBe('#cb5839');
      expect(firstCircle?.getAttribute('r')).toBeDefined();
      expect(firstCircle?.getAttribute('cx')).toBeDefined();
      expect(firstCircle?.getAttribute('cy')).toBeDefined();
    });
  });

  test('should recreate dots when size changes', async () => {
    const { container, rerender } = render(LoaderAnimation, { props: { size: 400 } });
    const dotsGroup = container.querySelector('#dots');

    await waitFor(() => {
      const circles = dotsGroup?.querySelectorAll('circle');
      expect(circles?.length).toBe(110);
    });

    // Get initial dot radius
    const initialRadius = dotsGroup?.querySelector('circle')?.getAttribute('r');

    // Update size using rerender
    await rerender({ size: 200 });

    await waitFor(() => {
      const newRadius = dotsGroup?.querySelector('circle')?.getAttribute('r');
      expect(newRadius).not.toBe(initialRadius);
    });
  });

  test('should have animation keyframes defined', () => {
    const { container } = render(LoaderAnimation);
    const svg = container.querySelector('svg');
    const style = svg?.querySelector('style');
    expect(style?.textContent).toContain('@keyframes rotateDots');
    expect(style?.textContent).toContain('@keyframes floatHead');
    expect(style?.textContent).toContain('@keyframes fadeShadow1');
    expect(style?.textContent).toContain('@keyframes fadeShadow2');
  });

  test('should initialize blinking animation with timeouts', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    render(LoaderAnimation);

    // Initial timeout for first blink
    expect(setTimeoutSpy).toHaveBeenCalled();
    const initialCalls = setTimeoutSpy.mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);

    // Fast-forward to trigger first blink
    vi.advanceTimersByTime(3000);

    // Should have more timeout calls after blink starts
    expect(setTimeoutSpy.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  test('should cleanup timeouts on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount } = render(LoaderAnimation);

    // Trigger some blinks
    vi.advanceTimersByTime(5000);

    unmount();

    // Should have cleared all timeouts
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  test('should render SVG defs for images', () => {
    const { container } = render(LoaderAnimation);
    const defs = container.querySelector('defs');
    expect(defs).toBeDefined();

    expect(defs?.querySelector('#shadow1')).toBeDefined();
    expect(defs?.querySelector('#shadow2')).toBeDefined();
    expect(defs?.querySelector('#head')).toBeDefined();
    expect(defs?.querySelector('#eyes')).toBeDefined();
  });

  test('should render clipPath for background', () => {
    const { container } = render(LoaderAnimation);
    const clipPath = container.querySelector('#backgroundClip');
    expect(clipPath).toBeDefined();
    expect(clipPath?.querySelector('circle')).toBeDefined();
  });

  test('should render head group with head and eyes', () => {
    const { container } = render(LoaderAnimation);
    const headGroup = container.querySelector('#headGroup');
    expect(headGroup).toBeDefined();
    expect(headGroup?.querySelectorAll('use').length).toBe(2);
  });

  test('should render shadow elements with correct blend mode', () => {
    const { container } = render(LoaderAnimation);
    const shadow1 = container.querySelector('#shadow1Element');
    const shadow2 = container.querySelector('#shadow2Element');

    expect(shadow1).toBeDefined();
    expect(shadow2).toBeDefined();
    expect((shadow1 as HTMLElement)?.style.mixBlendMode).toBe('soft-light');
    expect((shadow2 as HTMLElement)?.style.mixBlendMode).toBe('soft-light');
  });

  test('should calculate correct scale for different sizes', () => {
    const { container } = render(LoaderAnimation, { props: { size: 800 } });
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 800 800');
  });
});
