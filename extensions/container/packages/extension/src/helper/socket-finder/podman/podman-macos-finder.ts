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

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import { process } from '@kortex-app/api';
import { injectable } from 'inversify';

import type { SocketFinder } from '/@/api/socket-finder';
import {
  type PodmanMachineListInfo,
  zodPodmanMachineList,
} from '/@/helper/socket-finder/podman/podman-machine-list-info';

@injectable()
export class PodmanSocketMacOSFinder implements SocketFinder {
  async findPaths(): Promise<string[]> {
    // socket path is at $HOME/.local/share/containers/podman/machine/podman.sock
    const socketPath = resolve(homedir(), '.local/share/containers/podman/machine/podman.sock');

    // exists ?
    if (!existsSync(socketPath)) {
      return [];
    }

    try {
      // on macOS, run the command to list podman machines with the providers
      const { stdout } = await process.exec('podman', ['machine', 'ls', '--all-providers', '--format', 'json']);

      // use zod to parse the output
      const machines: PodmanMachineListInfo = zodPodmanMachineList.parse(JSON.parse(stdout));

      // filter the machines to keep only the running ones
      const runningMachines = machines.filter(m => m.Running);
      if (runningMachines.length > 0) {
        return [socketPath];
      }
    } catch (error: unknown) {
      console.debug('PodmanSocketMacOSFinder: unable to list podman machines', error);
    }

    return [];
  }
}
