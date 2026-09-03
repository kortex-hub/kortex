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

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import type { Directive } from 'micromark-extension-directive';

/**
 * Fallback handler for unrecognized directives.
 * Preserves the original text so that content like `:poof:` in
 * "look at that:poof!" is not silently stripped.
 *
 * @this {import('micromark-util-types').CompileContext}
 * @type {import('micromark-extension-directive').Handle}
 */
export function fallback(d: Directive): void {
  if (d.type === 'textDirective') {
    // Reconstruct the original text: :name[label]{attributes}
    this.raw(':' + (d.name ?? ''));
    if (d.label) {
      this.raw('[' + d.label + ']');
    }
    if (d.attributes && Object.keys(d.attributes).length > 0) {
      const attrs = Object.entries(d.attributes)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      this.raw('{' + attrs + '}');
    }
  }
}
