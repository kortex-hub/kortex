/**********************************************************************
 * Copyright (C) 2023-2025 Red Hat, Inc.
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

import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/svelte';
/* eslint-disable import/no-duplicates */
import { tick } from 'svelte';
/* eslint-enable import/no-duplicates */
import { beforeEach, expect, test, vi } from 'vitest';

import WelcomePage from './WelcomePage.svelte';

// fake the window.events object
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(window.getPodmanDesktopVersion).mockResolvedValue('1.0.0');
  (window.events as unknown) = {
    receive: (_channel: string, func: () => void): void => {
      func();
    },
  };
});

async function waitRender(customProperties: object): Promise<void> {
  render(WelcomePage, { ...customProperties });
  await tick();
}

test('Expect the close button is on the page', async () => {
  await waitRender({ showWelcome: true });
  const button = screen.getByRole('button', { name: 'Skip' });
  expect(button).toBeInTheDocument();
  expect(button).toBeEnabled();
});

test('Expect that the close button closes the window', async () => {
  await waitRender({ showWelcome: true });
  const button = screen.getByRole('button', { name: 'Skip' });
  await fireEvent.click(button);
  // and the button is gone
  expect(button).not.toBeInTheDocument();
});

test('Expect that telemetry UI is hidden when telemetry has already been prompted', async () => {
  vi.mocked(window.getConfigurationValue).mockResolvedValue('true');
  await waitRender({ showWelcome: true, showTelemetry: false });
  let checkbox;
  try {
    checkbox = screen.getByRole('checkbox', { name: 'Enable telemetry' });
  } catch {
    // ignore errors
  }
  expect(checkbox).toBe(undefined);
});

test('Expect that telemetry UI is visible when necessary', async () => {
  await waitRender({ showWelcome: true, showTelemetry: true });
  const checkbox = screen.getByRole('checkbox', { name: 'Enable telemetry' });
  expect(checkbox).toBeInTheDocument();
});

test('Expect that releaseNotesBanner.show configuration value is set to current version when showWelcome is set to true', async () => {
  await waitRender({});
  await vi.waitFor(() =>
    expect(vi.mocked(window.updateConfigurationValue)).toBeCalledWith(`releaseNotesBanner.show`, '1.0.0'),
  );
});

test('Expect that releaseNotesBanner.show configuration value is not set to current version when showWelcome is not set to true', async () => {
  vi.mocked(window.getConfigurationValue).mockResolvedValueOnce('value1');
  await waitRender({});
  expect(vi.mocked(window.updateConfigurationValue)).not.toBeCalledWith(`releaseNotesBanner.show`, '1.0.0');
});
