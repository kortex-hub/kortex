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
import type { components } from 'mcp-registry';

import type { ArgumentForm, RemoteServerConfigForm } from '../server-config-form';
import { FormGenerator } from './form-generator';

export class RemoteFormGenerator extends FormGenerator {
  constructor(protected remote: components['schemas']['Remote']) {
    super();
  }

  protected format(input: components['schemas']['KeyValueInput'], index: number): ArgumentForm {
    return {
      index: index,
      name: input.name,
      description: input.description,
      is_required: input.is_required,
      is_secret: input.is_secret,
    };
  }

  override generate(): RemoteServerConfigForm {
    return {
      type: 'remote',
      headers: (this.remote.headers ?? []).map(this.format.bind(this)),
    };
  }
}
