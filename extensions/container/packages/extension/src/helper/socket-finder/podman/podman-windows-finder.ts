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

import { process } from '@openkaiden/api';
import { inject, injectable } from 'inversify';

import type { SocketFinder } from '/@/api/socket-finder';
import {
  type PodmanMachineListInfo,
  zodPodmanMachineList,
} from '/@/helper/socket-finder/podman/podman-machine-list-info';
import { PodmanVersionDetector } from '/@/helper/socket-finder/podman/podman-version-detector';

// on Windows, npipe are stored in \\.\pipe\ with for example \\.\pipe\podman-machine-default for the default machine
@injectable()
export class PodmanSocketWindowsFinder implements SocketFinder {
  @inject(PodmanVersionDetector)
  private readonly versionDetector: PodmanVersionDetector;

  async findPaths(): Promise<string[]> {
    try {
      const majorVersion = await this.versionDetector.getMajorVersion();
      const args = ['machine', 'ls'];
      if (majorVersion < 6) {
        args.push('--all-providers');
      }
      args.push('--format', 'json');
      const { stdout: machineListOutput } = await process.exec('podman.exe', args);

      // use zod to parse the output
      const machines: PodmanMachineListInfo = zodPodmanMachineList.parse(JSON.parse(machineListOutput));

      // filter the machines to keep only the running ones
      const runningMachines = machines.filter(m => m.Running);
      // return all the socket paths from the running machines
      // if podman-machine-default the name is podman-machine-default else the pipe is podman-<machine-name>
      return runningMachines.map(m => {
        const pipeName = m.Name === 'podman-machine-default' ? 'podman-machine-default' : `podman-${m.Name}`;
        return `\\\\.\\pipe\\${pipeName}`;
      });
    } catch (error: unknown) {
      console.debug('PodmanSocketWindowsFinder: unable to list podman machines', error);
    }
    return [];
  }
}
