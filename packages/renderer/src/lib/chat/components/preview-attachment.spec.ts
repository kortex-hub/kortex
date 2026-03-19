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

import type { Attachment } from '@ai-sdk/ui-utils';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import PreviewAttachmentWrapper from './PreviewAttachmentTestWrapper.svelte';

function getAttachmentContainer(): HTMLElement {
  const container = document.querySelector('[data-slot="tooltip-trigger"]');
  if (!container) throw new Error('Attachment container with [data-slot="tooltip-trigger"] not found');
  return container as HTMLElement;
}

describe('preview-attachment.svelte', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function renderAttachment(props: { attachment: Attachment; uploading?: boolean; onremove?: () => void }): void {
    render(PreviewAttachmentWrapper, props);
  }

  test('renders image attachment with alt text', () => {
    const attachment: Attachment = {
      url: 'file:///path/to/image.png',
      name: 'image.png',
      contentType: 'image/png',
    };

    renderAttachment({ attachment });

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'image.png');
    expect(img).toHaveAttribute('src', 'file:///path/to/image.png');
  });

  test('renders non-image attachment without img element', () => {
    const attachment: Attachment = {
      url: 'file:///path/to/document.pdf',
      name: 'document.pdf',
      contentType: 'application/pdf',
    };

    renderAttachment({ attachment });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
  });

  test('decodes URL-encoded file name in label', () => {
    const attachment: Attachment = {
      url: 'file:///path/to/my%20file%20(1).pdf',
      name: 'my%20file%20(1).pdf',
      contentType: 'application/pdf',
    };

    renderAttachment({ attachment });

    expect(screen.getByText('my file (1).pdf')).toBeInTheDocument();
  });

  test('does not show remove button when onremove is not provided', async () => {
    const attachment: Attachment = {
      url: 'file:///path/to/file.txt',
      name: 'file.txt',
      contentType: 'text/plain',
    };

    renderAttachment({ attachment });

    const container = getAttachmentContainer();
    await fireEvent.mouseEnter(container);

    expect(screen.queryByLabelText('Remove attachment')).not.toBeInTheDocument();
  });

  test('renders remove button when onremove is provided', () => {
    const attachment: Attachment = {
      url: 'file:///path/to/file.txt',
      name: 'file.txt',
      contentType: 'text/plain',
    };
    const onremove = vi.fn();

    renderAttachment({ attachment, onremove });

    expect(screen.getByLabelText('Remove attachment')).toBeInTheDocument();
  });

  test('calls onremove when remove button is clicked', async () => {
    const attachment: Attachment = {
      url: 'file:///path/to/file.txt',
      name: 'file.txt',
      contentType: 'text/plain',
    };
    const onremove = vi.fn();

    renderAttachment({ attachment, onremove });

    const removeButton = screen.getByLabelText('Remove attachment');
    await fireEvent.click(removeButton);

    expect(onremove).toHaveBeenCalledOnce();
  });
});
