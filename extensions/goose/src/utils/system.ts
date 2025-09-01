/**********************************************************************
 * Copyright (C) 2023-2024 Red Hat, Inc.
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

import type { env as EnvAPI, process as ProcessAPI } from '@kortex-app/api';

/**
 * Given an executable name will find where it is installed on the system
 * @param executable
 */
export async function whereBinary(
  envAPI: typeof EnvAPI,
  processAPI: typeof ProcessAPI,
  executable: string,
): Promise<string> {
  // grab full path for Linux and mac
  if (envAPI.isLinux || envAPI.isMac) {
    try {
      const { stdout: fullPath } = await processAPI.exec('which', [executable]);
      return fullPath;
    } catch (err) {
      console.warn('Error getting full path', err);
    }
  } else if (envAPI.isWindows) {
    // grab full path for Windows
    try {
      const { stdout: fullPath } = await processAPI.exec('where.exe', [executable]);
      // remove all line break/carriage return characters from full path
      return fullPath.replace(/(\r\n|\n|\r)/gm, '');
    } catch (err) {
      console.warn('Error getting full path', err);
    }
  }

  throw new Error(`binary ${executable} not found.`);
}
