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
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ETCD_CONTENT = `
listen-client-urls: http://0.0.0.0:2379
advertise-client-urls: http://0.0.0.0:2379
quota-backend-bytes: 4294967296
auto-compaction-mode: revision
auto-compaction-retention: '1000'`;

export async function createConfigFile(
  storagePath: string,
): Promise<{ etcdConfigFile: string; userConfigFile: string }> {
  const etcdConfigFile = join(storagePath, 'embedEtcd.yaml');
  const userConfigFile = join(storagePath, 'user.yaml');
  await writeFile(etcdConfigFile, ETCD_CONTENT);
  await writeFile(userConfigFile, '');
  return { etcdConfigFile, userConfigFile };
}
