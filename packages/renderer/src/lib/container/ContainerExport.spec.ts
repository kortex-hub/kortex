/**********************************************************************
 * Copyright (C) 2024 Red Hat, Inc.
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

import type { Uri } from '@kortex-app/api';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { router } from 'tinro';
import { beforeEach, expect, test, vi } from 'vitest';

import { containersInfos } from '/@/stores/containers';
import type { ContainerInfo } from '/@api/container-info';

import ContainerExport from './ContainerExport.svelte';

const container: ContainerInfo = {
  engineId: 'engine',
  Id: 'container-id',
  Names: ['test'],
  Image: 'test-image',
  ImageID: 'test-image-id',
} as unknown as ContainerInfo;

beforeEach(() => {
  vi.clearAllMocks();
  containersInfos.set([]);
});

async function waitRender(): Promise<void> {
  render(ContainerExport, {
    containerID: 'container-id',
  });
  await tick();
}

test('Expect export button to be disabled', async () => {
  containersInfos.set([container]);
  await waitRender();
  const btnExportcontainer = screen.getByRole('button', { name: 'Export container' });
  expect(btnExportcontainer).toBeInTheDocument();
  expect(btnExportcontainer).toBeDisabled();
});

test('Expect export button to be enabled when output target is selected', async () => {
  containersInfos.set([container]);
  vi.mocked(window.saveDialog).mockResolvedValue({ scheme: 'file', path: '/tmp/my/path' } as Uri);
  await waitRender();
  const btnSelectOutputDir = screen.getByRole('button', { name: 'Select output file' });
  expect(btnSelectOutputDir).toBeInTheDocument();
  await userEvent.click(btnSelectOutputDir);

  const btnExportcontainer = screen.getByRole('button', { name: 'Export container' });
  expect(btnExportcontainer).toBeInTheDocument();
  expect(btnExportcontainer).toBeEnabled();
});

test('Expect export function called when export button is clicked', async () => {
  containersInfos.set([container]);
  vi.mocked(window.saveDialog).mockResolvedValue({ scheme: 'file', path: '/tmp/my/path' } as Uri);
  vi.mocked(window.exportContainer).mockResolvedValue(undefined);
  const goToMock = vi.spyOn(router, 'goto');
  await waitRender();
  const btnSelectOutputDir = screen.getByRole('button', { name: 'Select output file' });
  expect(btnSelectOutputDir).toBeInTheDocument();
  await userEvent.click(btnSelectOutputDir);

  const btnExportcontainer = screen.getByRole('button', { name: 'Export container' });
  expect(btnExportcontainer).toBeInTheDocument();
  await userEvent.click(btnExportcontainer);

  expect(window.exportContainer).toBeCalledWith(container.engineId, {
    id: container.Id,
    outputTarget: '/tmp/my/path',
  });
  expect(goToMock).toBeCalledWith('/containers');
});

test('Expect error shown if export function fails', async () => {
  containersInfos.set([container]);
  vi.mocked(window.saveDialog).mockResolvedValue({ scheme: 'file', path: '/tmp/my/path' } as Uri);
  vi.mocked(window.exportContainer).mockRejectedValue('error while exporting');
  const goToMock = vi.spyOn(router, 'goto');
  await waitRender();
  const btnSelectOutputDir = screen.getByRole('button', { name: 'Select output file' });
  expect(btnSelectOutputDir).toBeInTheDocument();
  await userEvent.click(btnSelectOutputDir);

  const btnExportcontainer = screen.getByRole('button', { name: 'Export container' });
  expect(btnExportcontainer).toBeInTheDocument();
  await userEvent.click(btnExportcontainer);

  const errorDiv = screen.getByLabelText('Error Message Content');

  expect(window.exportContainer).toBeCalledWith(container.engineId, {
    id: container.Id,
    outputTarget: '/tmp/my/path',
  });
  expect(goToMock).not.toBeCalled();
  expect(errorDiv).toBeInTheDocument();
  expect((errorDiv as HTMLDivElement).innerHTML).toContain('error while exporting');
});
