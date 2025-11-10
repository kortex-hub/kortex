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

export interface FlowParameters {
  description?: string;
  model?: string;
  mcpServer?: string;
  prompt?: string;
  instruction?: string;
}

export const builtInExtensions = [
  { name: 'Default MCP Registries', locator: 'kortex.mcp-registries' },
  { name: 'Gemini', locator: 'kortex.gemini' },
  { name: 'goose', locator: 'kortex.goose' },
  { name: 'OpenAI Compatible', locator: 'kortex.openai-compatible' },
  { name: 'OpenShift AI', locator: 'kortex.openshift-ai' },
] as const;

export type ExtensionLocator = (typeof builtInExtensions)[number]['locator'];

export enum Button {
  STOP = 'Stop',
  START = 'Start',
  DELETE = 'Delete',
}

export enum State {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export const BADGE_TEXT = 'built-in Extension' as const;

export enum BadgeType {
  BUILT_IN = 'badge-built-in Extension',
}

export enum ExtensionStatus {
  RUNNING = 'running',
  STOPPED = 'stopped',
  UNKNOWN = 'unknown',
}

export const proxyConfigurations = [
  { option: 'System', editable: false },
  { option: 'Manual', editable: true },
  { option: 'Disabled', editable: false },
] as const;

export type ProxyConfigurationOption = (typeof proxyConfigurations)[number]['option'];

export enum PreferenceOption {
  APPEARANCE = 'Appearance',
  EDITOR = 'Editor',
  EXIT_ON_CLOSE = 'Exit On Close',
  EXPERIMENTAL_STATUS_BAR = 'Experimental (Status Bar Providers)',
  EXTENSIONS = 'Extensions',
  KUBERNETES = 'Kubernetes',
  TASKS = 'Tasks',
  TELEMETRY = 'Telemetry',
  TERMINAL = 'Terminal',
  USER_CONFIRMATION = 'User Confirmation',
  WINDOW = 'Window',
}

export const preferenceOptions = (): PreferenceOption[] => Object.values(PreferenceOption);

export const resources = {
  openshiftai: { displayName: 'OpenShift AI', hasCreateButton: true },
  openai: { displayName: 'OpenAI', hasCreateButton: true },
  goose: { displayName: 'goose', hasCreateButton: false },
  gemini: { displayName: 'Gemini', hasCreateButton: true },
} as const;

export type SettingsResourceId = keyof typeof resources;

export const featuredResources = Object.keys(resources) as (keyof typeof resources)[];
export const resourcesWithCreateButton = Object.values(resources)
  .filter(r => r.hasCreateButton)
  .map(r => r.displayName);

export interface MCPServerConfig {
  readonly envVarName: string;
  readonly serverName: string;
}

export const MCP_SERVERS = {
  github: {
    envVarName: 'GITHUB_TOKEN',
    serverName: 'com.github.mcp',
  },
} as const satisfies Record<string, MCPServerConfig>;

export type MCPServerId = keyof typeof MCP_SERVERS;

export interface ResourceConfig {
  readonly envVarName: string;
  readonly resourceId: SettingsResourceId;
  readonly baseURL?: string;
}

export const PROVIDERS = {
  gemini: {
    envVarName: 'GEMINI_API_KEY',
    resourceId: 'gemini',
  },
  openai: {
    envVarName: 'OPENAI_API_KEY',
    resourceId: 'openai',
    baseURL: 'https://api.openai.com/v1',
  },
  'openshift-ai': {
    envVarName: 'OPENSHIFT_AI_TOKEN',
    resourceId: 'openshiftai',
  },
} as const satisfies Record<string, ResourceConfig>;

export type ResourceId = keyof typeof PROVIDERS;

export interface DialogOptions {
  dialogName?: string;
  buttonName?: string;
  timeout?: number;
  throwErrorOnFailOrMissing?: boolean;
  waitForDialogToDisappear?: boolean;
}

export const SELECTORS = {
  MAIN_ANY: 'main',
  MAIN_INITIALIZING: 'main.flex.flex-row.w-screen.h-screen.justify-center',
  MAIN_APP_CONTAINER: 'main.flex.flex-col.w-screen.h-screen.overflow-hidden',
  TITLE_BAR: 'header#navbar',
  WELCOME_PAGE: 'div:has-text("Get started with Kortex")',
  NAVIGATION: { role: 'navigation' as const, name: 'AppNavigation' },
} as const;

export const TIMEOUTS = {
  PAGE_LOAD: 90_000,
  NON_DEVTOOLS_WINDOW: 60_000,
  RETRY_DELAY: 1_000,
  MAX_RETRIES: 3,
  DEFAULT: 120_000,
  INITIALIZING_SCREEN: 180_000,
  STANDARD: 30_000,
  SHORT: 10_000,
} as const;
