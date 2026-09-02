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

import { expect, test } from 'vitest';

import { generalizeDenialPath } from './forge-path-generalizer.js';

test('GitHub REST API: generalizes repo path', () => {
  expect(generalizeDenialPath('api.github.com', '/repos/octocat/hello-world/contents/hello_world.py')).toBe(
    '/repos/octocat/hello-world/**',
  );
});

test('GitHub REST API: generalizes deeply nested path', () => {
  expect(generalizeDenialPath('api.github.com', '/repos/org/repo/git/refs/heads/main')).toBe('/repos/org/repo/**');
});

test('GitHub REST API: preserves exact repo path without subpath', () => {
  expect(generalizeDenialPath('api.github.com', '/repos/org/repo')).toBe('/repos/org/*');
});

test('GitHub git: generalizes .git subpath', () => {
  expect(generalizeDenialPath('github.com', '/org/repo.git/info/refs')).toBe('/org/repo.git/**');
});

test('GitHub git: generalizes git-receive-pack', () => {
  expect(generalizeDenialPath('github.com', '/org/repo.git/git-receive-pack')).toBe('/org/repo.git/**');
});

test('GitLab API v4: generalizes project path', () => {
  expect(generalizeDenialPath('gitlab.com', '/api/v4/projects/123/repository/branches')).toBe(
    '/api/v4/projects/123/**',
  );
});

test('GitLab API v4: generalizes namespaced project', () => {
  expect(generalizeDenialPath('gitlab.com', '/api/v4/projects/org%2Frepo/merge_requests')).toBe(
    '/api/v4/projects/org%2Frepo/**',
  );
});

test('GitLab self-hosted subdomain', () => {
  expect(generalizeDenialPath('code.gitlab.com', '/api/v4/projects/42/pipelines')).toBe('/api/v4/projects/42/**');
});

test('GitLab git: generalizes .git subpath', () => {
  expect(generalizeDenialPath('gitlab.com', '/org/repo.git/info/refs')).toBe('/org/repo.git/**');
});

test('Bitbucket REST API: generalizes repo path', () => {
  expect(generalizeDenialPath('api.bitbucket.org', '/2.0/repositories/org/repo/src/main/file.py')).toBe(
    '/2.0/repositories/org/repo/**',
  );
});

test('Bitbucket git: generalizes .git subpath', () => {
  expect(generalizeDenialPath('bitbucket.org', '/org/repo.git/info/refs')).toBe('/org/repo.git/**');
});

test('Unknown host: falls back to last-segment generalization', () => {
  expect(generalizeDenialPath('api.example.com', '/v1/resources/42')).toBe('/v1/resources/*');
});

test('Unknown host: single segment path stays unchanged', () => {
  expect(generalizeDenialPath('api.example.com', '/health')).toBe('/health');
});

test('Unknown host: deep path generalizes last segment only', () => {
  expect(generalizeDenialPath('custom.registry.io', '/v2/library/nginx/manifests/latest')).toBe(
    '/v2/library/nginx/manifests/*',
  );
});
