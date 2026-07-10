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

import { describe, expect, test } from 'vitest';

import {
  buildPolicyObject,
  collectBinaryFlags,
  collectEndpointFlags,
  formatEndpointFlag,
  OPENSHELL_CONTAINER_HOST,
  parseModelEndpoint,
  rewriteLocalhostUrl,
} from './openshell-network-policy.js';

describe('rewriteLocalhostUrl', () => {
  test('rewrites localhost to host.openshell.internal', () => {
    expect(rewriteLocalhostUrl('http://localhost:11434/v1')).toBe(`http://${OPENSHELL_CONTAINER_HOST}:11434/v1`);
  });

  test('rewrites 127.0.0.1 to host.openshell.internal', () => {
    expect(rewriteLocalhostUrl('http://127.0.0.1:11434/v1')).toBe(`http://${OPENSHELL_CONTAINER_HOST}:11434/v1`);
  });

  test('rewrites 0.0.0.0 to host.openshell.internal', () => {
    expect(rewriteLocalhostUrl('http://0.0.0.0:8080/v1')).toBe(`http://${OPENSHELL_CONTAINER_HOST}:8080/v1`);
  });

  test('does not rewrite external URLs', () => {
    expect(rewriteLocalhostUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1');
  });

  test('returns invalid strings unchanged', () => {
    expect(rewriteLocalhostUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('parseModelEndpoint', () => {
  test('parses HTTPS URL with default port', () => {
    expect(parseModelEndpoint('https://api.example.com/v1')).toEqual({
      host: 'api.example.com',
      port: 443,
    });
  });

  test('parses HTTP URL with default port', () => {
    expect(parseModelEndpoint('http://api.example.com/v1')).toEqual({
      host: 'api.example.com',
      port: 80,
    });
  });

  test('parses URL with explicit port', () => {
    expect(parseModelEndpoint('https://api.example.com:8443/v1')).toEqual({
      host: 'api.example.com',
      port: 8443,
    });
  });

  test('rewrites localhost and parses', () => {
    expect(parseModelEndpoint('http://localhost:11434/v1')).toEqual({
      host: OPENSHELL_CONTAINER_HOST,
      port: 11434,
    });
  });

  test('rewrites 127.0.0.1 and parses', () => {
    expect(parseModelEndpoint('http://127.0.0.1:11434/v1')).toEqual({
      host: OPENSHELL_CONTAINER_HOST,
      port: 11434,
    });
  });

  test('returns undefined for invalid URL', () => {
    expect(parseModelEndpoint('not-a-url')).toBeUndefined();
  });

  test('returns undefined for empty string', () => {
    expect(parseModelEndpoint('')).toBeUndefined();
  });

  test('returns undefined for unknown scheme without explicit port', () => {
    expect(parseModelEndpoint('ftp://files.example.com/data')).toBeUndefined();
  });

  test('parses unknown scheme when explicit port is provided', () => {
    expect(parseModelEndpoint('ftp://files.example.com:2121/data')).toEqual({
      host: 'files.example.com',
      port: 2121,
    });
  });
});

describe('buildPolicyObject', () => {
  test('returns undefined when no network and no model endpoint', () => {
    expect(buildPolicyObject()).toBeUndefined();
  });

  test('returns undefined for allow mode with no model endpoint', () => {
    expect(buildPolicyObject({ mode: 'allow' })).toBeUndefined();
  });

  test('returns undefined for deny mode with no hosts and no model endpoint', () => {
    expect(buildPolicyObject({ mode: 'deny' })).toBeUndefined();
  });

  test('returns undefined for deny mode with empty hosts and no model endpoint', () => {
    expect(buildPolicyObject({ mode: 'deny', hosts: [] })).toBeUndefined();
  });

  test('builds network rule for deny mode with hosts', () => {
    const policy = buildPolicyObject({ mode: 'deny', hosts: ['registry.npmjs.org'] });

    expect(policy).toEqual({
      version: 1,
      network_policies: {
        'kdn-network': {
          endpoints: [
            { host: 'registry.npmjs.org', port: 443, protocol: 'rest', access: 'full', allow_encoded_slash: true },
            { host: 'registry.npmjs.org', port: 80, protocol: 'rest', access: 'full', allow_encoded_slash: true },
          ],
          binaries: [{ path: '/**' }],
        },
      },
    });
  });

  test('builds model rule for valid endpoint', () => {
    const policy = buildPolicyObject(undefined, 'https://api.example.com/v1');

    expect(policy).toEqual({
      version: 1,
      network_policies: {
        'kdn-model': {
          endpoints: [{ host: 'api.example.com', port: 443 }],
          binaries: [{ path: '/**' }],
        },
      },
    });
  });

  test('combines network and model rules', () => {
    const policy = buildPolicyObject({ mode: 'deny', hosts: ['registry.npmjs.org'] }, 'http://localhost:11434/v1');

    expect(policy).toEqual({
      version: 1,
      network_policies: {
        'kdn-network': {
          endpoints: [
            { host: 'registry.npmjs.org', port: 443, protocol: 'rest', access: 'full', allow_encoded_slash: true },
            { host: 'registry.npmjs.org', port: 80, protocol: 'rest', access: 'full', allow_encoded_slash: true },
          ],
          binaries: [{ path: '/**' }],
        },
        'kdn-model': {
          endpoints: [{ host: OPENSHELL_CONTAINER_HOST, port: 11434 }],
          binaries: [{ path: '/**' }],
        },
      },
    });
  });

  test('rewrites localhost model endpoint', () => {
    const policy = buildPolicyObject(undefined, 'http://localhost:11434/v1');

    expect(policy!.network_policies!['kdn-model']!.endpoints[0]!.host).toBe(OPENSHELL_CONTAINER_HOST);
  });

  test('returns only model rule when network is allow mode', () => {
    const policy = buildPolicyObject({ mode: 'allow' }, 'https://api.example.com/v1');

    expect(Object.keys(policy!.network_policies!)).toEqual(['kdn-model']);
  });

  test('returns undefined for invalid model endpoint with no network', () => {
    expect(buildPolicyObject(undefined, 'not-a-url')).toBeUndefined();
  });
});

describe('formatEndpointFlag', () => {
  test('formats host and port only', () => {
    expect(formatEndpointFlag({ host: 'api.example.com', port: 443 })).toBe('api.example.com:443');
  });

  test('formats with access and protocol', () => {
    expect(formatEndpointFlag({ host: 'api.example.com', port: 443, access: 'full', protocol: 'rest' })).toBe(
      'api.example.com:443:full:rest',
    );
  });

  test('formats with enforcement', () => {
    expect(
      formatEndpointFlag({
        host: 'api.example.com',
        port: 443,
        access: 'read-only',
        protocol: 'rest',
        enforcement: 'enforce',
      }),
    ).toBe('api.example.com:443:read-only:rest:enforce');
  });

  test('ignores allow_encoded_slash (not supported by --add-endpoint)', () => {
    expect(
      formatEndpointFlag({
        host: 'registry.npmjs.org',
        port: 443,
        access: 'full',
        protocol: 'rest',
        allow_encoded_slash: true,
      }),
    ).toBe('registry.npmjs.org:443:full:rest');
  });

  test('appends websocket-credential-rewrite option', () => {
    expect(
      formatEndpointFlag({
        host: 'ws.example.com',
        port: 443,
        access: 'read-write',
        protocol: 'websocket',
        enforcement: 'enforce',
        websocket_credential_rewrite: true,
      }),
    ).toBe('ws.example.com:443:read-write:websocket:enforce:websocket-credential-rewrite');
  });

  test('combines multiple options', () => {
    expect(
      formatEndpointFlag({
        host: 'api.example.com',
        port: 443,
        access: 'full',
        protocol: 'rest',
        enforcement: 'enforce',
        websocket_credential_rewrite: true,
        request_body_credential_rewrite: true,
      }),
    ).toBe('api.example.com:443:full:rest:enforce:websocket-credential-rewrite,request-body-credential-rewrite');
  });
});

describe('collectEndpointFlags', () => {
  test('returns empty array when no network_policies', () => {
    expect(collectEndpointFlags({ version: 1 })).toEqual([]);
  });

  test('collects endpoints from all rules', () => {
    const flags = collectEndpointFlags({
      version: 1,
      network_policies: {
        'kdn-network': {
          endpoints: [
            { host: 'registry.npmjs.org', port: 443, access: 'full', protocol: 'rest', allow_encoded_slash: true },
          ],
          binaries: [{ path: '/**' }],
        },
        'kdn-model': {
          endpoints: [{ host: 'api.example.com', port: 443 }],
          binaries: [{ path: '/**' }],
        },
      },
    });

    expect(flags).toEqual(['registry.npmjs.org:443:full:rest', 'api.example.com:443']);
  });
});

describe('collectBinaryFlags', () => {
  test('returns empty array when no network_policies', () => {
    expect(collectBinaryFlags({ version: 1 })).toEqual([]);
  });

  test('collects binary paths from all rules', () => {
    const flags = collectBinaryFlags({
      version: 1,
      network_policies: {
        'kdn-network': {
          endpoints: [{ host: 'registry.npmjs.org', port: 443 }],
          binaries: [{ path: '/**' }],
        },
        'kdn-model': {
          endpoints: [{ host: 'api.example.com', port: 443 }],
          binaries: [{ path: '/**' }],
        },
      },
    });

    expect(flags).toEqual(['/**']);
  });

  test('deduplicates binary paths', () => {
    const flags = collectBinaryFlags({
      version: 1,
      network_policies: {
        rule1: {
          endpoints: [{ host: 'a.com', port: 443 }],
          binaries: [{ path: '/**' }, { path: '/usr/bin/curl' }],
        },
        rule2: {
          endpoints: [{ host: 'b.com', port: 443 }],
          binaries: [{ path: '/**' }],
        },
      },
    });

    expect(flags).toEqual(['/**', '/usr/bin/curl']);
  });

  test('handles rules with empty binaries', () => {
    const flags = collectBinaryFlags({
      version: 1,
      network_policies: {
        rule1: {
          endpoints: [{ host: 'a.com', port: 443 }],
          binaries: [],
        },
      },
    });

    expect(flags).toEqual([]);
  });
});
