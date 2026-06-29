/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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

import { env, process } from '@openkaiden/api';
import { injectable } from 'inversify';
import { coerce, major } from 'semver';

@injectable()
export class PodmanVersionDetector {
  #cachedMajorVersion: number | undefined;

  async getMajorVersion(): Promise<number> {
    if (this.#cachedMajorVersion !== undefined) {
      return this.#cachedMajorVersion;
    }

    try {
      const binary = env.isWindows ? 'podman.exe' : 'podman';
      const { stdout } = await process.exec(binary, ['--version']);
      // output is like "podman version X.Y.Z"
      const version = coerce(stdout.trim());
      if (version) {
        this.#cachedMajorVersion = major(version);
        return this.#cachedMajorVersion;
      }
    } catch (error: unknown) {
      console.debug('PodmanVersionDetector: unable to detect podman version', error);
    }

    // default to 6 (newest behavior, no --all-providers)
    this.#cachedMajorVersion = 6;
    return this.#cachedMajorVersion;
  }
}
