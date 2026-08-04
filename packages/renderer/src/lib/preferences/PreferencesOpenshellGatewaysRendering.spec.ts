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

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { beforeEach, expect, test, vi } from 'vitest';

import { extensionInfos } from '/@/stores/extensions';
import { openshellGateways } from '/@/stores/openshell-gateways';
import type { GatewayInfo } from '/@api/openshell-gateway-info';

import PreferencesOpenshellGatewaysRendering from './PreferencesOpenshellGatewaysRendering.svelte';

function setOpenshellStarted(): void {
  extensionInfos.set([
    {
      id: 'kaiden.openshell',
      name: 'openshell',
      description: '',
      displayName: 'OpenShell',
      publisher: 'kaiden',
      removable: false,
      devMode: false,
      version: '0.4.0',
      state: 'started',
      path: '',
      readme: '',
    },
  ]);
}

beforeEach(() => {
  vi.resetAllMocks();
  extensionInfos.set([]);
  openshellGateways.set([]);
});

test('shows not-running message when OpenShell extension is not started', () => {
  render(PreferencesOpenshellGatewaysRendering);

  expect(screen.getByText('OpenShell extension is not running')).toBeInTheDocument();
});

test('shows empty screen when extension is started but no gateways are registered', () => {
  setOpenshellStarted();
  render(PreferencesOpenshellGatewaysRendering);

  expect(screen.getByText('No gateways found')).toBeInTheDocument();
});

test('displays active gateway in the Active Gateway section', () => {
  setOpenshellStarted();
  const activeGateway: GatewayInfo = {
    name: 'kaiden-local',
    endpoint: 'http://127.0.0.1:17670',
    active: true,
    type: 'local',
    gatewayState: { reachable: true, health: 'healthy' },
  };
  openshellGateways.set([activeGateway]);
  render(PreferencesOpenshellGatewaysRendering);

  expect(screen.getByText('Active Gateway')).toBeInTheDocument();
  expect(screen.getByText('kaiden-local')).toBeInTheDocument();
  expect(screen.getByText('Managed')).toBeInTheDocument();
  expect(screen.getByText('local · http://127.0.0.1:17670 · Connected')).toBeInTheDocument();

  const statusDot = screen.getAllByLabelText('Gateway state')[0];
  expect(statusDot).toHaveClass('bg-(--pd-status-running)');

  expect(screen.queryByText('Other Gateways')).not.toBeInTheDocument();
});

test('displays non-active gateways in Other Gateways section', () => {
  setOpenshellStarted();
  const gateways: GatewayInfo[] = [
    {
      name: 'kaiden-local',
      endpoint: 'http://127.0.0.1:17670',
      active: true,
      type: 'local',
    },
    {
      name: 'production',
      endpoint: 'https://gateway.example.com',
      active: false,
      type: 'remote',
      is_remote: true,
      remote_host: 'user@gateway.example.com',
    },
  ];
  openshellGateways.set(gateways);
  render(PreferencesOpenshellGatewaysRendering);

  expect(screen.getByText('Active Gateway')).toBeInTheDocument();
  expect(screen.getByText('Other Gateways')).toBeInTheDocument();
  expect(screen.getByText('production')).toBeInTheDocument();
  expect(screen.getByText('Referenced')).toBeInTheDocument();
  expect(screen.getByText('remote · https://gateway.example.com · Unknown')).toBeInTheDocument();
});

test('shows Referenced badge for non-local gateways', () => {
  setOpenshellStarted();
  const gateways: GatewayInfo[] = [
    {
      name: 'remote-gw',
      endpoint: 'https://remote.example.com',
      active: false,
      type: 'remote',
    },
  ];
  openshellGateways.set(gateways);
  render(PreferencesOpenshellGatewaysRendering);

  expect(screen.getByText('Referenced')).toBeInTheDocument();
});

test('shows Managed badge for local gateways', () => {
  setOpenshellStarted();
  const gateways: GatewayInfo[] = [
    {
      name: 'local-gw',
      endpoint: 'http://localhost:17670',
      active: true,
      type: 'local',
    },
  ];
  openshellGateways.set(gateways);
  render(PreferencesOpenshellGatewaysRendering);

  expect(screen.getByText('Managed')).toBeInTheDocument();
});

test('hides empty screen when gateways exist', () => {
  setOpenshellStarted();
  openshellGateways.set([{ name: 'gw', endpoint: 'http://localhost:17670', active: true }]);
  render(PreferencesOpenshellGatewaysRendering);

  const emptyTitle = screen.queryByText('No gateways found');
  expect(emptyTitle).toBeInTheDocument();
  expect(emptyTitle?.closest('[hidden]') ?? emptyTitle?.closest('.hidden')).toBeTruthy();
});

test('renders multiple non-active gateways', () => {
  setOpenshellStarted();
  const gateways: GatewayInfo[] = [
    { name: 'active-gw', endpoint: 'http://localhost:17670', active: true, type: 'local' },
    { name: 'team-shared', endpoint: 'https://team.example.com', active: false, type: 'remote', is_remote: true },
    { name: 'dev-remote', endpoint: 'https://dev.example.com', active: false, type: 'remote' },
  ];
  openshellGateways.set(gateways);
  render(PreferencesOpenshellGatewaysRendering);

  expect(screen.getByText('team-shared')).toBeInTheDocument();
  expect(screen.getByText('dev-remote')).toBeInTheDocument();
});

test('shows unknown state text and color when gatewayState is undefined', () => {
  setOpenshellStarted();
  openshellGateways.set([{ name: 'no-state-gw', endpoint: 'http://localhost:17670', active: true }]);
  render(PreferencesOpenshellGatewaysRendering);

  expect(screen.getByText('http://localhost:17670 · Unknown')).toBeInTheDocument();
  const statusDot = screen.getByLabelText('Gateway state');
  expect(statusDot).toHaveClass('bg-(--pd-status-unknown)');
});

test('shows disconnected state text and stopped color when gateway is unreachable', () => {
  setOpenshellStarted();
  openshellGateways.set([
    {
      name: 'unreachable-gw',
      endpoint: 'http://localhost:17670',
      active: true,
      gatewayState: { reachable: false, health: 'unknown' },
    },
  ]);
  render(PreferencesOpenshellGatewaysRendering);

  expect(screen.getByText('http://localhost:17670 · Disconnected')).toBeInTheDocument();
  const statusDot = screen.getByLabelText('Gateway state');
  expect(statusDot).toHaveClass('bg-(--pd-status-stopped)');
});

test('shows degraded state text and color for degraded gateway', () => {
  setOpenshellStarted();
  openshellGateways.set([
    {
      name: 'degraded-gw',
      endpoint: 'http://localhost:17670',
      active: true,
      gatewayState: { reachable: true, health: 'degraded' },
    },
  ]);
  render(PreferencesOpenshellGatewaysRendering);

  expect(screen.getByText('http://localhost:17670 · Degraded')).toBeInTheDocument();
  const statusDot = screen.getByLabelText('Gateway state');
  expect(statusDot).toHaveClass('bg-(--pd-status-degraded)');
});

test('shows unhealthy state text and terminated color for unhealthy gateway', () => {
  setOpenshellStarted();
  openshellGateways.set([
    {
      name: 'unhealthy-gw',
      endpoint: 'http://localhost:17670',
      active: true,
      gatewayState: { reachable: true, health: 'unhealthy' },
    },
  ]);
  render(PreferencesOpenshellGatewaysRendering);

  expect(screen.getByText('http://localhost:17670 · Unhealthy')).toBeInTheDocument();
  const statusDot = screen.getByLabelText('Gateway state');
  expect(statusDot).toHaveClass('bg-(--pd-status-terminated)');
});

test('shows connected state text and running color for healthy gateway', () => {
  setOpenshellStarted();
  openshellGateways.set([
    {
      name: 'healthy-gw',
      endpoint: 'http://localhost:17670',
      active: true,
      gatewayState: { reachable: true, health: 'healthy' },
    },
  ]);
  render(PreferencesOpenshellGatewaysRendering);

  expect(screen.getByText('http://localhost:17670 · Connected')).toBeInTheDocument();
  const statusDot = screen.getByLabelText('Gateway state');
  expect(statusDot).toHaveClass('bg-(--pd-status-running)');
});
