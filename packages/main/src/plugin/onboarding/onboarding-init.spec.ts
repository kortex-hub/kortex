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

import { beforeEach, expect, test, vi } from 'vitest';

import { OnboardingSettings } from '/@/plugin/onboarding/onboarding-settings.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import { CONFIGURATION_DEFAULT_SCOPE } from '/@api/configuration/constants.js';
import type { IConfigurationNode, IConfigurationRegistry } from '/@api/configuration/models.js';
import { WelcomeSettings } from '/@api/welcome/welcome-settings.js';

import type { CommandRegistry } from '../command-registry.js';
import type { OnboardingRegistry } from '../onboarding-registry.js';
import { OnboardingInit } from './onboarding-init.js';

let registeredConfigs: IConfigurationNode[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registeredCommands = new Map<string, (...args: any[]) => any>();

const configurationRegistry = {
  registerConfigurations: vi.fn((configs: IConfigurationNode[]) => {
    registeredConfigs = configs;
  }),
  updateConfigurationValue: vi.fn(),
} as unknown as IConfigurationRegistry;

const commandRegistry = {
  registerCommand: vi.fn((command: string, callback: (...args: unknown[]) => unknown) => {
    registeredCommands.set(command, callback);
    return { dispose: vi.fn() };
  }),
} as unknown as CommandRegistry;

const onboardingRegistry = {
  listOnboarding: vi.fn(),
  resetOnboarding: vi.fn(),
} as unknown as OnboardingRegistry;

const apiSender = {
  send: vi.fn(),
} as unknown as ApiSenderType;

beforeEach(() => {
  vi.resetAllMocks();
  registeredConfigs = [];
  registeredCommands.clear();
});

test('registers onboarding configuration with hidden properties', () => {
  const init = new OnboardingInit(configurationRegistry, commandRegistry, onboardingRegistry, apiSender);
  init.init();

  expect(configurationRegistry.registerConfigurations).toHaveBeenCalledOnce();
  expect(registeredConfigs).toHaveLength(1);

  const config = registeredConfigs.at(0);
  expect(config).toBeDefined();
  expect(config?.id).toBe('preferences.onboarding');
  expect(
    config?.properties?.[`${OnboardingSettings.SectionName}.${OnboardingSettings.DefaultWorkspaceSettings}`],
  ).toBeDefined();
});

test('registers defaultWorkspaceSettings as hidden object property', () => {
  const init = new OnboardingInit(configurationRegistry, commandRegistry, onboardingRegistry, apiSender);
  init.init();

  const config = registeredConfigs.at(0);
  expect(config?.properties?.['onboarding.defaultWorkspaceSettings']).toEqual(
    expect.objectContaining({ type: 'object', default: {}, hidden: true }),
  );
});

test('registers onboardAgain as markdown property', () => {
  const init = new OnboardingInit(configurationRegistry, commandRegistry, onboardingRegistry, apiSender);
  init.init();

  const config = registeredConfigs.at(0);
  const property = config?.properties?.['onboarding.onboardAgain'];
  expect(property).toBeDefined();
  expect(property?.type).toBe('markdown');
  expect(property?.markdownDescription).toContain(':button[Onboard again]');
  expect(property?.markdownDescription).toContain('command=onboarding.resetAndRestart');
});

test('registers onboarding.resetAndRestart command', () => {
  const init = new OnboardingInit(configurationRegistry, commandRegistry, onboardingRegistry, apiSender);
  init.init();

  expect(commandRegistry.registerCommand).toHaveBeenCalledWith('onboarding.resetAndRestart', expect.any(Function));
  expect(registeredCommands.has('onboarding.resetAndRestart')).toBe(true);
});

test('resetAndRestart command resets onboarding, clears welcome version, and sends event', async () => {
  vi.mocked(onboardingRegistry.listOnboarding).mockReturnValue([{ extension: 'ext1' }, { extension: 'ext2' }] as never);

  const init = new OnboardingInit(configurationRegistry, commandRegistry, onboardingRegistry, apiSender);
  init.init();

  const command = registeredCommands.get('onboarding.resetAndRestart');
  expect(command).toBeDefined();
  await command!();

  expect(onboardingRegistry.resetOnboarding).toHaveBeenCalledWith(['ext1', 'ext2']);
  expect(configurationRegistry.updateConfigurationValue).toHaveBeenCalledWith(
    `${WelcomeSettings.SectionName}.${WelcomeSettings.Version}`,
    undefined,
    CONFIGURATION_DEFAULT_SCOPE,
  );
  expect(apiSender.send).toHaveBeenCalledWith('onboarding:restart');
});

test('resetAndRestart command skips resetOnboarding when no extensions registered', async () => {
  vi.mocked(onboardingRegistry.listOnboarding).mockReturnValue([]);

  const init = new OnboardingInit(configurationRegistry, commandRegistry, onboardingRegistry, apiSender);
  init.init();

  const command = registeredCommands.get('onboarding.resetAndRestart');
  await command!();

  expect(onboardingRegistry.resetOnboarding).not.toHaveBeenCalled();
  expect(configurationRegistry.updateConfigurationValue).toHaveBeenCalled();
  expect(apiSender.send).toHaveBeenCalledWith('onboarding:restart');
});

test('dispose cleans up registered commands', () => {
  const init = new OnboardingInit(configurationRegistry, commandRegistry, onboardingRegistry, apiSender);
  init.init();

  const disposable = vi.mocked(commandRegistry.registerCommand).mock.results[0]?.value;
  init.dispose();

  expect(disposable.dispose).toHaveBeenCalled();
});
