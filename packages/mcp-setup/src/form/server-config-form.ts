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

export interface ArgumentForm {
  /**
   * The index of the argument
   */
  index: number;
  name?: string;
  description?: string;
  // mandatory field
  is_required: boolean;
  is_secret: boolean;
}

export interface LocalServerConfigForm {
  type: 'local';
  runtime: Array<ArgumentForm>;
  package: Array<ArgumentForm>;
  environment: Array<ArgumentForm>;
}

export interface RemoteServerConfigForm {
  type: 'remote';
  headers: Array<ArgumentForm>;
}

export type ServerConfigForm = LocalServerConfigForm | RemoteServerConfigForm;
