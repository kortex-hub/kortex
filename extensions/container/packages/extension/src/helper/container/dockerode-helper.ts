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

import Dockerode from 'dockerode';

export class DockerodeHelper {
  async getConnection(socketPath: string): Promise<Dockerode> {
    const connection = new Dockerode({ socketPath });

    // add a race Promise to timeout after 5 seconds if ping does not respond
    // test the connection
    await Promise.race([
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Connection timeout while pinging container engine socket path ${socketPath}`)),
          5_000,
        ),
      ),
      connection.ping(),
    ]);

    return connection;
  }
}
