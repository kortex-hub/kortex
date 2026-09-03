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

export interface Info {
  host: Host;
  store: Store;
  registries: Registries;
  plugins: Plugins;
  version: Version;
}

export interface Host {
  arch: string;
  buildahVersion: string;
  cgroupManager: string;
  cgroupVersion: string;
  cgroupControllers: unknown[];
  conmon: Conmon;
  cpus: number;
  cpuUtilization: CpuUtilization;
  databaseBackend: string;
  distribution: Distribution;
  eventLogger: string;
  hostname: string;
  idMappings: IdMappings;
  kernel: string;
  logDriver: string;
  memFree: number;
  memTotal: number;
  networkBackend: string;
  ociRuntime: OciRuntime;
  os: string;
  remoteSocket: RemoteSocket;
  serviceIsRemote: boolean;
  security: Security;
  slirp4netns: Slirp4netns;
  swapFree: number;
  swapTotal: number;
  uptime: string;
  linkmode: string;
}

export interface Conmon {
  package: string;
  path: string;
  version: string;
}

export interface CpuUtilization {
  userPercent: number;
  systemPercent: number;
  idlePercent: number;
}

export interface Distribution {
  distribution: string;
  variant: string;
  version: string;
}

export interface IdMappings {
  gidmap: Gidmap[];
  uidmap: Uidmap[];
}

export interface Gidmap {
  container_id: number;
  host_id: number;
  size: number;
}

export interface Uidmap {
  container_id: number;
  host_id: number;
  size: number;
}

export interface OciRuntime {
  name: string;
  package: string;
  path: string;
  version: string;
}

export interface RemoteSocket {
  path: string;
  exists: boolean;
}

export interface Security {
  apparmorEnabled: boolean;
  capabilities: string;
  rootless: boolean;
  seccompEnabled: boolean;
  seccompProfilePath: string;
  selinuxEnabled: boolean;
}

export interface Slirp4netns {
  executable: string;
  package: string;
  version: string;
}

export interface Store {
  configFile: string;
  containerStore: ContainerStore;
  graphDriverName: string;
  graphOptions: GraphOptions;
  graphRoot: string;
  graphRootAllocated: number;
  graphRootUsed: number;
  graphStatus: GraphStatus;
  imageCopyTmpDir: string;
  imageStore: ImageStore;
  runRoot: string;
  volumePath: string;
  transientStore: boolean;
}

export interface ContainerStore {
  number: number;
  paused: number;
  running: number;
  stopped: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GraphOptions {}

export interface GraphStatus {
  'Backing Filesystem': string;
  'Native Overlay Diff': string;
  'Supports d_type': string;
  'Using metacopy': string;
}

export interface ImageStore {
  number: number;
}

export interface Registries {
  search: string[];
}

export interface Plugins {
  volume: string[];
  network: string[];
  log: string[];
  authorization: unknown;
}

export interface Version {
  APIVersion: string;
  Version: string;
  GoVersion: string;
  GitCommit: string;
  BuiltTime: string;
  Built: number;
  OsArch: string;
  Os: string;
}
