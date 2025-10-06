/**********************************************************************
 * Copyright (C) 2022 Red Hat, Inc.
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

/**
 * Mock the extension API for vitest.
 * This file is referenced from vitest.config.js file.
 */
const mcpRegistry = {
  suggestRegistry: vi.fn(),
};

const plugin = { mcpRegistry };
const provider = {
  createProvider: vi.fn(),
};

const env = {
  createTelemetryLogger: vi.fn(),
};

const process = {
  exec: vi.fn(),
};

const plugin = { provider, mcpRegistry, env, process };
module.exports = plugin;
