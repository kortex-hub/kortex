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

// eslint-disable-next-line import/no-extraneous-dependencies
import Dockerode from 'dockerode';
import { injectable } from 'inversify';

import type { Info } from '/@/helper/podman-info';

const UNIX_SOCKET_PREFIX = 'unix://';

@injectable()
export class SocketHelper {
  async getInfo(dockerode: Dockerode): Promise<Info> {
    const optsf = {
      path: '/v4.2.0/libpod/info',
      method: 'GET',
      statusCodes: {
        200: true,
        500: 'server error',
      },
      options: {},
    };

    return new Promise((resolve, reject) => {
      dockerode.modem.dial(optsf, (err: unknown, data: unknown) => {
        if (err) {
          return reject(err);
        }
        resolve(data as Info);
      });
    });
  }

  async getSocketPath(dockerode: Dockerode): Promise<string> {
    const info = await this.getInfo(dockerode);
    const path = info.host.remoteSocket.path;
    if (path.startsWith(UNIX_SOCKET_PREFIX)) {
      return path.slice(UNIX_SOCKET_PREFIX.length);
    }
    return path;
  }
}
