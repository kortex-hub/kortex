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

import { expect, test } from 'vitest';

import { FileContentDetector } from './file-content-detector.js';

const detector = new FileContentDetector();
const textBuffer = Buffer.from('hello world');

test.each([
  'text/plain',
  'text/html',
  'text/x-java-source',
  'text/csv',
])('should detect MIME type %s as text', mimeType => {
  expect(detector.isTextContent(mimeType, undefined, textBuffer)).toBe(true);
});

test.each([
  'image/png',
  'image/jpeg',
  'audio/mpeg',
  'video/mp4',
  'application/pdf',
])('should detect MIME type %s as binary', mimeType => {
  expect(detector.isTextContent(mimeType, undefined, textBuffer)).toBe(false);
});

test.each([
  'script.py',
  'Main.java',
  'index.ts',
  'style.css',
  'config.yaml',
  'app.svelte',
  'query.sql',
  'schema.graphql',
  'settings.properties',
  'main.go',
  'lib.rs',
  'app.vue',
  'Dockerfile',
  'Makefile',
])('should detect %s as text by filename and buffer', filename => {
  expect(detector.isTextContent('application/x-unknown', filename, textBuffer)).toBe(true);
});

test('should detect binary content with null bytes', () => {
  const bufferWithNull = Buffer.from([0x68, 0x65, 0x6c, 0x00, 0x6c, 0x6f]);
  expect(detector.isTextContent('application/x-unknown', 'file.xyz', bufferWithNull)).toBe(false);
});

test('should not apply buffer fallback for known binary MIME types', () => {
  expect(detector.isTextContent('application/pdf', 'doc.pdf', textBuffer)).toBe(false);
});

test('should fall through to buffer detection for application/octet-stream', () => {
  expect(detector.isTextContent('application/octet-stream', undefined, textBuffer)).toBe(true);
  const binaryBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(detector.isTextContent('application/octet-stream', undefined, binaryBuffer)).toBe(false);
});
