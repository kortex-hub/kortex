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
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { toast } from 'svelte-sonner';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { EditState } from '/@/lib/chat/hooks/edit-state.svelte';
import { LocalStorage } from '/@/lib/chat/hooks/local-storage.svelte';

import MultimodalInput from './multimodal-input.svelte';

vi.mock(import('svelte-sonner'));
vi.mock(import('/@/lib/chat/hooks/edit-state.svelte'));
vi.mock(import('/@/lib/chat/hooks/local-storage.svelte'));

// Minimal chatClient stub satisfying the component's needs
function createChatClient(): object {
  return {
    status: 'ready' as string,
    messages: [] as unknown[],
    sendMessage: vi.fn(),
    stop: vi.fn(),
    regenerate: vi.fn(),
  };
}

function dataTransfer(files: File[], types: string[] = ['Files']): DataTransfer {
  return {
    files: files as unknown as FileList,
    types,
  } as unknown as DataTransfer;
}

function fakeFile(name: string, type: string, content: string): File {
  return new File([content], name, { type });
}

// Polyfill element.animate for jsdom (used by Svelte transitions)
if (!HTMLElement.prototype.animate) {
  HTMLElement.prototype.animate = vi.fn(() => ({
    finished: Promise.resolve(),
    onfinish: null,
    cancel: vi.fn(),
  })) as unknown as typeof HTMLElement.prototype.animate;
}

describe('multimodal-input drag and drop', () => {
  let attachments: Attachment[];

  beforeEach(() => {
    vi.resetAllMocks();
    attachments = [];

    vi.mocked(EditState.fromContext).mockReturnValue({
      isAfterEditingMessage: vi.fn(() => false),
      isEditing: false,
      startEditing: vi.fn(),
      editingMessage: undefined,
      cancelEditing: vi.fn(),
    });

    Object.defineProperty(LocalStorage.prototype, 'value', {
      get: () => '',
      set: vi.fn(),
      configurable: true,
    });
  });

  function renderComponent(): { container: HTMLElement; dropZone: Element; chatClient: object } {
    const chatClient = createChatClient();
    const { container } = render(MultimodalInput, {
      attachments,
      chatClient: chatClient as never,
      selectedMCPTools: new Map() as never,
    });
    // The drop target is the outer div with the border classes
    const dropZone = container.querySelector('.rounded-2xl')!;
    return { container, dropZone, chatClient };
  }

  test('dragenter with files sets dashed border styling', async () => {
    const { dropZone } = renderComponent();

    await fireEvent.dragEnter(dropZone, { dataTransfer: dataTransfer([]) });

    expect(dropZone.className).toContain('border-dashed');
    expect(dropZone.className).toContain('border-primary');
  });

  test('dragenter without files does not set dashed border', async () => {
    const { dropZone } = renderComponent();

    await fireEvent.dragEnter(dropZone, { dataTransfer: dataTransfer([], ['text/plain']) });

    expect(dropZone.className).not.toContain('border-dashed');
  });

  test('dragleave removes dashed border styling', async () => {
    const { dropZone } = renderComponent();

    await fireEvent.dragEnter(dropZone, { dataTransfer: dataTransfer([]) });
    expect(dropZone.className).toContain('border-dashed');

    await fireEvent.dragLeave(dropZone);
    expect(dropZone.className).not.toContain('border-dashed');
  });

  test('dropping a file adds it to attachments', async () => {
    const { dropZone } = renderComponent();
    const file = fakeFile('photo.png', 'image/png', 'fake-image-data');

    await fireEvent.drop(dropZone, { dataTransfer: dataTransfer([file]) });

    await waitFor(() => {
      expect(attachments).toHaveLength(1);
    });
    expect(attachments[0].name).toBe('photo.png');
    expect(attachments[0].contentType).toBe('image/png');
    expect(attachments[0].url).toContain('data:image/png;base64,');
  });

  test('dropping a file with empty MIME type defaults to application/octet-stream', async () => {
    const { dropZone } = renderComponent();
    const file = fakeFile('data.xyz', '', 'some-data');

    await fireEvent.drop(dropZone, { dataTransfer: dataTransfer([file]) });

    await waitFor(() => {
      expect(attachments).toHaveLength(1);
    });
    expect(attachments[0].contentType).toBe('application/octet-stream');
  });

  test('dropping multiple files adds all to attachments', async () => {
    const { dropZone } = renderComponent();
    const files = [fakeFile('a.txt', 'text/plain', 'hello'), fakeFile('b.json', 'application/json', '{}')];

    await fireEvent.drop(dropZone, { dataTransfer: dataTransfer(files) });

    await waitFor(() => {
      expect(attachments).toHaveLength(2);
    });
    expect(attachments[0].name).toBe('a.txt');
    expect(attachments[1].name).toBe('b.json');
  });

  test('drop removes dashed border styling', async () => {
    const { dropZone } = renderComponent();

    await fireEvent.dragEnter(dropZone, { dataTransfer: dataTransfer([]) });
    expect(dropZone.className).toContain('border-dashed');

    const file = fakeFile('doc.pdf', 'application/pdf', 'pdf-bytes');
    await fireEvent.drop(dropZone, { dataTransfer: dataTransfer([file]) });

    expect(dropZone.className).not.toContain('border-dashed');
  });

  test('drop with no files does nothing', async () => {
    const { dropZone } = renderComponent();

    await fireEvent.drop(dropZone, { dataTransfer: dataTransfer([]) });

    expect(attachments).toHaveLength(0);
  });

  test('drop with no dataTransfer does nothing', async () => {
    const { dropZone } = renderComponent();

    await fireEvent.drop(dropZone);

    expect(attachments).toHaveLength(0);
  });

  test('dropping an oversized file shows error toast and skips it', async () => {
    vi.mocked(window.getConfigurationValue).mockResolvedValue(20);
    const { dropZone } = renderComponent();
    // Create a file stub with size > 20 MB
    const largeFile = fakeFile('huge.bin', 'application/octet-stream', 'x');
    Object.defineProperty(largeFile, 'size', { value: 21 * 1024 * 1024 });

    await fireEvent.drop(dropZone, { dataTransfer: dataTransfer([largeFile]) });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('huge.bin'),
        expect.objectContaining({
          action: expect.objectContaining({ label: 'Settings' }),
        }),
      );
    });
    expect(attachments).toHaveLength(0);
  });

  test('dropping a text selection is not intercepted', async () => {
    const { dropZone } = renderComponent();
    const preventDefault = vi.fn();

    dropZone.dispatchEvent(
      Object.assign(new Event('drop', { bubbles: true }), {
        dataTransfer: dataTransfer([], ['text/plain']),
        preventDefault,
      }),
    );

    expect(preventDefault).not.toHaveBeenCalled();
    expect(attachments).toHaveLength(0);
  });

  test('attach button rejects oversized file', async () => {
    vi.mocked(window.getConfigurationValue).mockResolvedValue(20);
    vi.mocked(window.openDialog).mockResolvedValue(['/path/to/huge.bin']);
    vi.mocked(window.pathFileSize).mockResolvedValue(21 * 1024 * 1024);

    renderComponent();
    const attachButton = screen.getByRole('button', { name: 'Attach file' });
    await fireEvent.click(attachButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('huge.bin'),
        expect.objectContaining({
          action: expect.objectContaining({ label: 'Settings' }),
        }),
      );
    });
    expect(attachments).toHaveLength(0);
  });

  test('attach button extracts filename from Windows path', async () => {
    vi.mocked(window.getConfigurationValue).mockResolvedValue(20);
    vi.mocked(window.openDialog).mockResolvedValue(['C:\\Users\\test\\huge.bin']);
    vi.mocked(window.pathFileSize).mockResolvedValue(21 * 1024 * 1024);

    renderComponent();
    const attachButton = screen.getByRole('button', { name: 'Attach file' });
    await fireEvent.click(attachButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('huge.bin'), expect.anything());
    });
  });

  test('attach button allows file within size limit', async () => {
    vi.mocked(window.getConfigurationValue).mockResolvedValue(20);
    vi.mocked(window.openDialog).mockResolvedValue(['/path/to/small.txt']);
    vi.mocked(window.pathFileSize).mockResolvedValue(1024);
    vi.mocked(window.pathMimeType).mockResolvedValue('text/plain');

    renderComponent();
    const attachButton = screen.getByRole('button', { name: 'Attach file' });
    await fireEvent.click(attachButton);

    await waitFor(() => {
      expect(attachments).toHaveLength(1);
    });
    expect(attachments[0].name).toBe('small.txt');
  });

  test('textarea is still present and functional', () => {
    renderComponent();
    const textarea = screen.getByPlaceholderText('Send a message...');
    expect(textarea).toBeInTheDocument();
  });
});
