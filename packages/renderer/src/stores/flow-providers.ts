import { derived } from 'svelte/store';

import { cliToolInfos } from './cli-tools';

export const hasInstalledFlowProviders = derived(cliToolInfos, $cliToolInfos => {
  return !!$cliToolInfos.find(c => c.path && c.id === 'kortex.goose.goose');
});
