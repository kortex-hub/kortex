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

interface ForgePattern {
  hostMatch: (host: string) => boolean;
  pathRegex: RegExp;
  generalize: (match: RegExpMatchArray) => string;
}

const FORGE_PATTERNS: ForgePattern[] = [
  // GitHub REST API: /repos/{org}/{repo}/...
  {
    hostMatch: (h: string) => h === 'api.github.com',
    pathRegex: /^(\/repos\/[^/]+\/[^/]+)\/.+/,
    generalize: (m: RegExpMatchArray) => `${m[1]}/**`,
  },
  // GitHub git smart HTTP: /{org}/{repo}.git/...
  {
    hostMatch: (h: string) => h === 'github.com',
    pathRegex: /^(\/[^/]+\/[^/]+\.git)\/.+/,
    generalize: (m: RegExpMatchArray) => `${m[1]}/**`,
  },
  // GitLab API v4: /api/v4/projects/{id_or_namespace}/...
  {
    hostMatch: (h: string) => h === 'gitlab.com' || h.endsWith('.gitlab.com'),
    pathRegex: /^(\/api\/v4\/projects\/[^/]+)\/.+/,
    generalize: (m: RegExpMatchArray) => `${m[1]}/**`,
  },
  // GitLab git smart HTTP: /{org}/{repo}.git/...
  {
    hostMatch: (h: string) => h === 'gitlab.com' || h.endsWith('.gitlab.com'),
    pathRegex: /^(\/[^/]+\/[^/]+\.git)\/.+/,
    generalize: (m: RegExpMatchArray) => `${m[1]}/**`,
  },
  // Bitbucket REST API: /2.0/repositories/{org}/{repo}/...
  {
    hostMatch: (h: string) => h === 'api.bitbucket.org',
    pathRegex: /^(\/2\.0\/repositories\/[^/]+\/[^/]+)\/.+/,
    generalize: (m: RegExpMatchArray) => `${m[1]}/**`,
  },
  // Bitbucket git smart HTTP: /{org}/{repo}.git/...
  {
    hostMatch: (h: string) => h === 'bitbucket.org',
    pathRegex: /^(\/[^/]+\/[^/]+\.git)\/.+/,
    generalize: (m: RegExpMatchArray) => `${m[1]}/**`,
  },
];

export function generalizeDenialPath(host: string, path: string): string {
  for (const pattern of FORGE_PATTERNS) {
    if (!pattern.hostMatch(host)) continue;
    const match = pattern.pathRegex.exec(path);
    if (match) {
      return pattern.generalize(match);
    }
  }

  // Fallback: generalize the last path segment only
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash > 0) {
    return `${path.substring(0, lastSlash)}/*`;
  }
  return path;
}
