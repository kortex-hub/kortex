/**********************************************************************
 * Copyright (C) 2024 Red Hat, Inc.
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
import { expect, test } from 'vitest';

import LoaderAnimation from './LoaderAnimation.svelte';

test('Expect default size', async () => {
  render(LoaderAnimation);
  const loaderAnimation = screen.getByRole('img', { hidden: true, name: '' });
  expect(loaderAnimation).toBeInTheDocument();
  const defaultValue = '400';

  // check the width is set to default
  expect(loaderAnimation).toHaveAttribute('width', defaultValue);

  // check the height is set to default
  expect(loaderAnimation).toHaveAttribute('height', defaultValue);
});

test('Expect specified size', async () => {
  const size = '200';
  render(LoaderAnimation, {
    size,
  });
  const loaderAnimation = screen.getByRole('img', { hidden: true, name: '' });
  expect(loaderAnimation).toBeInTheDocument();

  // check the width is set to 200
  expect(loaderAnimation).toHaveAttribute('width', '200');

  // check the height is set to 200
  expect(loaderAnimation).toHaveAttribute('height', '200');
});
