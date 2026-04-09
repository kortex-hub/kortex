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

import { arch } from 'node:os';

import type { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import { env, type ExtensionContext, window } from '@openkaiden/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { GooseDownloader } from './goose-downloader';

// Mock node:os module
vi.mock(import('node:os'));

const octokitMock = {
  repos: {
    listReleases: vi.fn(),
    listReleaseAssets: vi.fn(),
    getReleaseAsset: vi.fn(),
  },
} as unknown as Octokit;

const extensionContextMock = {
  storagePath: '/mock/storage/path',
} as unknown as ExtensionContext;

describe('GooseDownloader#getReleaseAssetId', () => {
  let downloader: GooseDownloader;

  beforeEach(() => {
    vi.resetAllMocks();
    downloader = new GooseDownloader(extensionContextMock, octokitMock, env, window);
  });

  describe('Windows x64', () => {
    beforeEach(async () => {
      vi.mocked(env).isWindows = true;
      vi.mocked(env).isMac = false;
      vi.mocked(env).isLinux = false;
      vi.mocked(arch).mockReturnValue('x64');
    });

    test('should find MSVC variant for v1.24.0+', async () => {
      const msvcAsset = { id: 1, name: 'goose-x86_64-pc-windows-msvc.zip' };
      const gnuAsset = { id: 2, name: 'goose-x86_64-pc-windows-gnu.zip' };

      vi.mocked(octokitMock.repos.listReleaseAssets).mockResolvedValue({
        data: [msvcAsset, gnuAsset],
      } as RestEndpointMethodTypes['repos']['listReleaseAssets']['response']);

      const result = await downloader.getReleaseAssetId(123);

      expect(result).toEqual(msvcAsset);
      expect(octokitMock.repos.listReleaseAssets).toHaveBeenCalledWith({
        owner: 'block',
        repo: 'goose',
        release_id: 123,
        per_page: 60,
      });
    });

    test('should fallback to GNU variant for older versions', async () => {
      const gnuAsset = { id: 2, name: 'goose-x86_64-pc-windows-gnu.zip' };

      vi.mocked(octokitMock.repos.listReleaseAssets).mockResolvedValue({
        data: [gnuAsset],
      } as RestEndpointMethodTypes['repos']['listReleaseAssets']['response']);

      const result = await downloader.getReleaseAssetId(123);

      expect(result).toEqual(gnuAsset);
    });

    test('should accept GNU variant when both exist', async () => {
      const gnuAsset = { id: 2, name: 'goose-x86_64-pc-windows-gnu.zip' };
      const msvcAsset = { id: 1, name: 'goose-x86_64-pc-windows-msvc.zip' };

      vi.mocked(octokitMock.repos.listReleaseAssets).mockResolvedValue({
        data: [gnuAsset, msvcAsset],
      } as RestEndpointMethodTypes['repos']['listReleaseAssets']['response']);

      const result = await downloader.getReleaseAssetId(123);

      // Should match GNU
      expect(result).toEqual(gnuAsset);
    });

    test('should throw error if no Windows asset found', async () => {
      vi.mocked(octokitMock.repos.listReleaseAssets).mockResolvedValue({
        data: [{ id: 3, name: 'goose-x86_64-apple-darwin.tar.bz2' }],
      } as RestEndpointMethodTypes['repos']['listReleaseAssets']['response']);

      await expect(downloader.getReleaseAssetId(123)).rejects.toThrow('No asset found for x64 on Windows');
    });

    test('should throw error for unsupported architecture', async () => {
      vi.mocked(arch).mockReturnValue('arm');

      vi.mocked(octokitMock.repos.listReleaseAssets).mockResolvedValue({
        data: [],
      } as unknown as RestEndpointMethodTypes['repos']['listReleaseAssets']['response']);

      await expect(downloader.getReleaseAssetId(123)).rejects.toThrow('Unsupported architecture for windows: arm');
    });
  });

  describe('macOS', () => {
    beforeEach(() => {
      vi.mocked(env).isWindows = false;
      vi.mocked(env).isMac = true;
      vi.mocked(env).isLinux = false;
    });

    test('should find arm64 asset', async () => {
      vi.mocked(arch).mockReturnValue('arm64');

      const arm64Asset = { id: 1, name: 'goose-aarch64-apple-darwin.tar.bz2' };

      vi.mocked(octokitMock.repos.listReleaseAssets).mockResolvedValue({
        data: [arm64Asset],
      } as RestEndpointMethodTypes['repos']['listReleaseAssets']['response']);

      const result = await downloader.getReleaseAssetId(123);

      expect(result).toEqual(arm64Asset);
    });

    test('should find x64 asset', async () => {
      vi.mocked(arch).mockReturnValue('x64');

      const x64Asset = { id: 1, name: 'goose-x86_64-apple-darwin.tar.bz2' };

      vi.mocked(octokitMock.repos.listReleaseAssets).mockResolvedValue({
        data: [x64Asset],
      } as RestEndpointMethodTypes['repos']['listReleaseAssets']['response']);

      const result = await downloader.getReleaseAssetId(123);

      expect(result).toEqual(x64Asset);
    });

    test('should throw error for unsupported architecture', async () => {
      vi.mocked(arch).mockReturnValue('ppc');

      await expect(downloader.getReleaseAssetId(123)).rejects.toThrow('Unsupported architecture for mac: ppc');
    });
  });

  describe('Linux', () => {
    beforeEach(() => {
      vi.mocked(env).isWindows = false;
      vi.mocked(env).isMac = false;
      vi.mocked(env).isLinux = true;
    });

    test('should find arm64 asset', async () => {
      vi.mocked(arch).mockReturnValue('arm64');

      const arm64Asset = { id: 1, name: 'goose-aarch64-unknown-linux-gnu.tar.bz2' };

      vi.mocked(octokitMock.repos.listReleaseAssets).mockResolvedValue({
        data: [arm64Asset],
      } as RestEndpointMethodTypes['repos']['listReleaseAssets']['response']);

      const result = await downloader.getReleaseAssetId(123);

      expect(result).toEqual(arm64Asset);
    });

    test('should find x64 asset', async () => {
      vi.mocked(arch).mockReturnValue('x64');

      const x64Asset = { id: 1, name: 'goose-x86_64-unknown-linux-gnu.tar.bz2' };

      vi.mocked(octokitMock.repos.listReleaseAssets).mockResolvedValue({
        data: [x64Asset],
      } as RestEndpointMethodTypes['repos']['listReleaseAssets']['response']);

      const result = await downloader.getReleaseAssetId(123);

      expect(result).toEqual(x64Asset);
    });

    test('should throw error if no Linux asset found', async () => {
      vi.mocked(arch).mockReturnValue('x64');

      vi.mocked(octokitMock.repos.listReleaseAssets).mockResolvedValue({
        data: [{ id: 3, name: 'goose-x86_64-pc-windows-msvc.zip' }],
      } as RestEndpointMethodTypes['repos']['listReleaseAssets']['response']);

      await expect(downloader.getReleaseAssetId(123)).rejects.toThrow('No asset found for x64 on Linux');
    });
  });
});

describe('GooseDownloader#grabLatestsReleasesMetadata', () => {
  let downloader: GooseDownloader;

  beforeEach(() => {
    vi.resetAllMocks();
    downloader = new GooseDownloader(extensionContextMock, octokitMock, env, window);
  });

  test('should return last 5 non-prerelease versions', async () => {
    const releases = [
      { id: 1, tag_name: 'v1.25.0', name: 'Goose 1.25.0', prerelease: false },
      { id: 2, tag_name: 'v1.24.0', name: 'Goose 1.24.0', prerelease: false },
      { id: 3, tag_name: 'v1.24.0-rc1', name: 'Goose 1.24.0-rc1', prerelease: true },
      { id: 4, tag_name: 'v1.23.0', name: 'Goose 1.23.0', prerelease: false },
      { id: 5, tag_name: 'v1.22.0', name: 'Goose 1.22.0', prerelease: false },
      { id: 6, tag_name: 'v1.21.0', name: 'Goose 1.21.0', prerelease: false },
      { id: 7, tag_name: 'v1.20.0', name: 'Goose 1.20.0', prerelease: false },
    ];

    vi.mocked(octokitMock.repos.listReleases).mockResolvedValue({
      data: releases,
    } as RestEndpointMethodTypes['repos']['listReleases']['response']);

    const result = await downloader.grabLatestsReleasesMetadata();

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ label: 'Goose 1.25.0', tag: 'v1.25.0', id: 1 });
    expect(result[1]).toEqual({ label: 'Goose 1.24.0', tag: 'v1.24.0', id: 2 });
    expect(result[2]).toEqual({ label: 'Goose 1.23.0', tag: 'v1.23.0', id: 4 });
    expect(result[3]).toEqual({ label: 'Goose 1.22.0', tag: 'v1.22.0', id: 5 });
    expect(result[4]).toEqual({ label: 'Goose 1.21.0', tag: 'v1.21.0', id: 6 });
  });

  test('should filter out prerelease versions', async () => {
    const releases = [
      { id: 1, tag_name: 'v1.25.0-beta', name: 'Goose 1.25.0 Beta', prerelease: true },
      { id: 2, tag_name: 'v1.24.0', name: 'Goose 1.24.0', prerelease: false },
    ];

    vi.mocked(octokitMock.repos.listReleases).mockResolvedValue({
      data: releases,
    } as RestEndpointMethodTypes['repos']['listReleases']['response']);

    const result = await downloader.grabLatestsReleasesMetadata();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ label: 'Goose 1.24.0', tag: 'v1.24.0', id: 2 });
  });

  test('should use tag_name when name is null', async () => {
    const releases = [{ id: 1, tag_name: 'v1.24.0', name: null, prerelease: false }];

    vi.mocked(octokitMock.repos.listReleases).mockResolvedValue({
      data: releases,
    } as RestEndpointMethodTypes['repos']['listReleases']['response']);

    const result = await downloader.grabLatestsReleasesMetadata();

    expect(result[0].label).toBe('v1.24.0');
  });
});
