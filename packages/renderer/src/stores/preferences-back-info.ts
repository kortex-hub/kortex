import { writable } from 'svelte/store';

import type { NavigationPage } from '/@api/navigation-page';

import type { InferredNavigationRequest } from '../navigation';

export interface PreferencesBackInfo {
  name?: string;
  navigationRequest?: InferredNavigationRequest<NavigationPage>;
}

export const preferencesBackInfoStore = writable<PreferencesBackInfo>({});
