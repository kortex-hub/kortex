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

function dispatchPaste(
  element: HTMLElement,
  options: {
    files?: File[];
    items?: Array<{ kind: string; type: string; getAsFile: () => File | null }>;
    types?: string[];
    textData?: string;
  },
): boolean {
  const files = options.files ?? [];
  const items = options.items ?? [];
  const types = options.types ?? [];

  const itemsIterator = items[Symbol.iterator].bind(items);
  const clipboardData = {
    files: Object.assign(files, { item: (i: number): File => files[i] }),
    items: Object.assign(items, {
      item: (i: number) => items[i],
      add: vi.fn(),
      clear: vi.fn(),
      remove: vi.fn(),
      [Symbol.iterator]: () => itemsIterator(),
    }),
    types,
    getData: (format: string): string => {
      if (format === 'text/plain') return options.textData ?? '';
      return '';
    },
  };

  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  return !element.dispatchEvent(event);
}

// Polyfill element.animate for jsdom (used by Svelte transitions)
if (!HTMLElement.prototype.animate) {
  HTMLElement.prototype.animate = vi.fn(() => ({
    finished: Promise.resolve(),
    onfinish: null,
    cancel: vi.fn(),
  })) as unknown as typeof HTMLElement.prototype.animate;
}

function setupMocks(): void {
  vi.resetAllMocks();

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
}

describe('multimodal-input drag and drop', () => {
  let attachments: Attachment[];

  beforeEach(() => {
    setupMocks();
    attachments = [];
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

  test('dropping a file with empty MIME type resolves type from filename', async () => {
    vi.mocked(window.pathMimeType).mockResolvedValue('application/octet-stream');
    const { dropZone } = renderComponent();
    const file = fakeFile('data.xyz', '', 'some-data');

    await fireEvent.drop(dropZone, { dataTransfer: dataTransfer([file]) });

    await waitFor(() => {
      expect(attachments).toHaveLength(1);
    });
    expect(window.pathMimeType).toHaveBeenCalledWith('data.xyz');
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

describe('multimodal-input paste handling', () => {
  let attachments: Attachment[];

  beforeEach(() => {
    setupMocks();
    attachments = [];
  });

  function renderAndGetTextarea(): HTMLElement {
    render(MultimodalInput, {
      attachments,
      chatClient: createChatClient() as never,
      selectedMCPTools: new Map() as never,
    });
    return screen.getByPlaceholderText('Send a message...');
  }

  test('pasting an image from clipboard adds it as an attachment', async () => {
    const imageFile = new File(['fake-png-data'], 'image.png', { type: 'image/png' });
    const textarea = renderAndGetTextarea();

    dispatchPaste(textarea, {
      files: [imageFile],
      items: [{ kind: 'file', type: 'image/png', getAsFile: (): File => imageFile }],
      types: ['Files'],
    });

    await waitFor(() => {
      expect(attachments).toHaveLength(1);
    });
    expect(attachments[0].name).toBe('image.png');
    expect(attachments[0].contentType).toBe('image/png');
    expect(attachments[0].url).toContain('data:image/png;base64,');
  });

  test('pasting multiple files adds all as attachments', async () => {
    const file1 = new File(['content1'], 'document.pdf', { type: 'application/pdf' });
    const file2 = new File(['content2'], 'readme.txt', { type: 'text/plain' });
    const textarea = renderAndGetTextarea();

    dispatchPaste(textarea, {
      files: [file1, file2],
      items: [
        { kind: 'file', type: 'application/pdf', getAsFile: (): File => file1 },
        { kind: 'file', type: 'text/plain', getAsFile: (): File => file2 },
      ],
      types: ['Files'],
    });

    await waitFor(() => {
      expect(attachments).toHaveLength(2);
    });
    expect(attachments[0].name).toBe('document.pdf');
    expect(attachments[1].name).toBe('readme.txt');
  });

  test('pasting a file without a MIME type resolves it from the filename', async () => {
    const file = new File(['data'], 'photo.jpg', { type: '' });
    vi.mocked(window.pathMimeType).mockResolvedValue('image/jpeg');
    const textarea = renderAndGetTextarea();

    dispatchPaste(textarea, {
      files: [file],
      items: [{ kind: 'file', type: '', getAsFile: (): File => file }],
      types: ['Files'],
    });

    await waitFor(() => {
      expect(attachments).toHaveLength(1);
    });
    expect(window.pathMimeType).toHaveBeenCalledWith('photo.jpg');
    expect(attachments[0].contentType).toBe('image/jpeg');
  });

  test('pasting with files but empty items still adds attachments', async () => {
    const imageFile = new File(['fake-png-data'], 'image.png', { type: 'image/png' });
    const textarea = renderAndGetTextarea();

    dispatchPaste(textarea, {
      files: [imageFile],
      items: [],
      types: ['Files'],
    });

    await waitFor(() => {
      expect(attachments).toHaveLength(1);
    });
    expect(attachments[0].name).toBe('image.png');
  });

  test('pasting plain text does not add attachments', () => {
    const textarea = renderAndGetTextarea();

    dispatchPaste(textarea, {
      files: [],
      items: [{ kind: 'string', type: 'text/plain', getAsFile: (): null => null }],
      types: ['text/plain'],
      textData: 'hello world',
    });

    expect(attachments).toHaveLength(0);
  });

  test('pasting files with text data lets normal paste handle it', () => {
    const imageFile = new File(['data'], 'image.png', { type: 'image/png' });
    const textarea = renderAndGetTextarea();

    const wasIntercepted = dispatchPaste(textarea, {
      files: [imageFile],
      items: [{ kind: 'file', type: 'image/png', getAsFile: (): File => imageFile }],
      types: ['Files', 'text/plain'],
      textData: 'some text content',
    });

    expect(wasIntercepted).toBe(false);
    expect(attachments).toHaveLength(0);
  });

  test('pasting with empty clipboardData does nothing', () => {
    const textarea = renderAndGetTextarea();

    dispatchPaste(textarea, {
      files: [],
      items: [],
      types: [],
    });

    expect(attachments).toHaveLength(0);
  });

  test('pasting an oversized file shows error toast and skips it', async () => {
    vi.mocked(window.getConfigurationValue).mockResolvedValue(20);
    const largeFile = new File(['x'], 'huge.bin', { type: 'application/octet-stream' });
    Object.defineProperty(largeFile, 'size', { value: 21 * 1024 * 1024 });
    const textarea = renderAndGetTextarea();

    dispatchPaste(textarea, {
      files: [largeFile],
      items: [{ kind: 'file', type: 'application/octet-stream', getAsFile: (): File => largeFile }],
      types: ['Files'],
    });

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
});
