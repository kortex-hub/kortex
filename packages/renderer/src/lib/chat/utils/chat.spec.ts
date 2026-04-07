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

import type { FileUIPart } from 'ai';
import { describe, expect, test } from 'vitest';

import { fileUIPart2Attachment } from './chat.js';

describe('fileUIPart2Attachment', () => {
  test('should use filename when available', () => {
    const part: FileUIPart = {
      type: 'file',
      filename: 'photo.png',
      mediaType: 'image/png',
      url: 'data:image/png;base64,iVBOR',
    };

    const attachment = fileUIPart2Attachment(part);

    expect(attachment.name).toBe('photo.png');
    expect(attachment.contentType).toBe('image/png');
    expect(attachment.url).toBe(part.url);
  });

  test('should extract name from URL when filename is missing', () => {
    const part: FileUIPart = {
      type: 'file',
      mediaType: 'image/jpeg',
      url: 'file:///Users/test/images/screenshot.jpg',
    };

    const attachment = fileUIPart2Attachment(part);

    expect(attachment.name).toBe('screenshot.jpg');
  });

  test('should handle data URL gracefully when filename is missing', () => {
    const part: FileUIPart = {
      type: 'file',
      mediaType: 'image/png',
      url: 'data:image/png;base64,iVBOR',
    };

    const attachment = fileUIPart2Attachment(part);

    // Without filename, falls back to URL parsing — not ideal but expected
    expect(attachment.name).toBeDefined();
    expect(attachment.contentType).toBe('image/png');
  });
});
