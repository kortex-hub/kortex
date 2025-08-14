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

// definition of a MCP server as listed in a MCP registry
// it should come frome types https://github.com/modelcontextprotocol/registry/issues/186

export type MCPRegistryAuthMethod = 'github' | 'none';

export type MCPRegistryServerStatus = 'active' | 'deprecated';

export interface MCPRegistryAuthentication {
  method?: MCPRegistryAuthMethod;
  token?: string;
  repo_ref?: string;
}

export interface MCPRegistryRepository {
  url: string;
  source: string;
  id: string;
}

export type MCPRegistryFormat = 'string' | 'number' | 'boolean' | 'file_path';

export interface MCPRegistryInput {
  description?: string;
  is_required?: boolean;
  format?: MCPRegistryFormat;
  value?: string;
  is_secret?: boolean;
  default?: string;
  choices?: string[];
  template?: string;
  name?: string;
}

export interface MCPRegistryInputWithVariables extends MCPRegistryInput {
  variables?: Record<string, MCPRegistryInput>;
}

export interface MCPRegistryKeyValueInput extends MCPRegistryInputWithVariables {
  name: string;
}

export type MCPRegistryArgumentType = 'positional' | 'named';

export interface MCPRegistryArgument extends MCPRegistryInputWithVariables {
  type: MCPRegistryArgumentType;
  name?: string;
  is_repeated?: boolean;
  value_hint?: string;
}

export interface MCPRegistryPackage {
  registry_name: string;
  name: string;
  version: string;
  runtime_hint?: string;
  runtime_arguments?: MCPRegistryArgument[];
  package_arguments?: MCPRegistryArgument[];
  environment_variables?: MCPRegistryKeyValueInput[];
}

export interface MCPRegistryRemote {
  transport_type: string;
  url: string;
  headers?: MCPRegistryInput[];
}

export interface MCPRegistryVersionDetail {
  version: string;
  release_date: string;
  is_latest: boolean;
}

export interface MCPRegistryServer {
  id: string;
  name: string;
  description: string;
  status?: MCPRegistryServerStatus;
  repository: MCPRegistryRepository;
  version_detail: MCPRegistryVersionDetail;
}

export interface MCPRegistryServerDetail extends MCPRegistryServer {
  packages?: MCPRegistryPackage[];
  remotes?: MCPRegistryRemote[];
}

export interface MCPRegistryServerList {
  servers: MCPRegistryServer[];
  metadata: { next_cursor?: string; count: number };
}
