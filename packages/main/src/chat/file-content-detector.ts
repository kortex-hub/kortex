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

import { isText } from 'istextorbinary';

/**
 * Detects whether file content should be treated as text or binary
 * for model consumption. Delegates to the istextorbinary library
 * which combines filename-based and buffer-based detection.
 * Known binary MIME types (images, audio, video, PDF) are rejected
 * early to avoid false positives.
 */
export class FileContentDetector {
  private static readonly BINARY_MIME_PREFIXES = ['image/', 'audio/', 'video/'];
  private static readonly BINARY_MIME_TYPES = new Set(['application/pdf']);

  /**
   * Determines whether a file should be sent as text content rather than a
   * binary file part.
   */
  isTextContent(mediaType: string, filename: string | undefined, buffer: Buffer): boolean {
    if (mediaType.startsWith('text/')) return true;
    if (this.isKnownBinaryMimeType(mediaType)) return false;
    return isText(filename ?? null, buffer) === true;
  }

  private isKnownBinaryMimeType(mediaType: string): boolean {
    if (FileContentDetector.BINARY_MIME_TYPES.has(mediaType)) return true;
    return FileContentDetector.BINARY_MIME_PREFIXES.some(prefix => mediaType.startsWith(prefix));
  }
}
