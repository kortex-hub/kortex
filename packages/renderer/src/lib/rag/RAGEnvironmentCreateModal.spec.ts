/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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
import { beforeEach, expect, test, vi } from 'vitest';

import type { ProviderInfo } from '/@api/provider-info';

import RAGEnvironmentCreateModal from './RAGEnvironmentCreateModal.svelte';

const closeMock = vi.fn();
const onCreateMock = vi.fn();

const mockProviders: ProviderInfo[] = [
  {
    ragConnections: [{ name: 'VectorDB' }],
    chunkConnections: [{ id: 'embed-1', name: 'EmbedModel' }],
    id: 'provider-1',
    name: 'TestProvider',
  } as unknown as ProviderInfo,
];

beforeEach(() => {
  vi.resetAllMocks();
});

test('should render the dialog with correct title', () => {
  render(RAGEnvironmentCreateModal, {
    providers: mockProviders,
    closeCallback: closeMock,
    onCreate: onCreateMock,
  });

  expect(screen.getByText('New Knowledge Environment')).toBeInTheDocument();
});

test('should render using Dialog component without distinct header/footer backgrounds', () => {
  const { container } = render(RAGEnvironmentCreateModal, {
    providers: mockProviders,
    closeCallback: closeMock,
    onCreate: onCreateMock,
  });

  // Verify no element has the modal header background that causes white bars
  const elementsWithHeaderBg = container.querySelectorAll('[class*="bg-[var(--pd-modal-header-bg)]"]');
  expect(elementsWithHeaderBg.length).toBe(0);
});

test('should render environment name input', () => {
  render(RAGEnvironmentCreateModal, {
    providers: mockProviders,
    closeCallback: closeMock,
    onCreate: onCreateMock,
  });

  expect(screen.getByText('Environment Name')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Enter knowledge environment name')).toBeInTheDocument();
});

test('should render vector store and embedding model sections', () => {
  render(RAGEnvironmentCreateModal, {
    providers: mockProviders,
    closeCallback: closeMock,
    onCreate: onCreateMock,
  });

  expect(screen.getByText('Vector Store')).toBeInTheDocument();
  expect(screen.getByText('Embedding Model')).toBeInTheDocument();
});

test('should render provider connection options', () => {
  render(RAGEnvironmentCreateModal, {
    providers: mockProviders,
    closeCallback: closeMock,
    onCreate: onCreateMock,
  });

  expect(screen.getByText('VectorDB')).toBeInTheDocument();
  expect(screen.getByText('EmbedModel')).toBeInTheDocument();
});

test('should have Create Environment button disabled when form is empty', () => {
  render(RAGEnvironmentCreateModal, {
    providers: mockProviders,
    closeCallback: closeMock,
    onCreate: onCreateMock,
  });

  expect(screen.getByRole('button', { name: 'Create Environment' })).toBeDisabled();
});

test('should call closeCallback when Cancel is clicked', async () => {
  render(RAGEnvironmentCreateModal, {
    providers: mockProviders,
    closeCallback: closeMock,
    onCreate: onCreateMock,
  });

  const cancelButton = screen.getByRole('button', { name: 'Cancel' });
  await fireEvent.click(cancelButton);

  expect(closeMock).toHaveBeenCalled();
});
