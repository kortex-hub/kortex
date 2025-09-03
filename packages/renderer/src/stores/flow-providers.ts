import { derived } from 'svelte/store';

import { cliToolInfos } from './cli-tools';

const gooseCliToolId = 'kortex.goose.goose';

export const gooseCliTool = derived(cliToolInfos, $cliToolInfos => {
  return $cliToolInfos.find(c => c.id === gooseCliToolId);
});

export const hasInstalledFlowProviders = derived(cliToolInfos, $cliToolInfos => {
  return !!$cliToolInfos.find(c => c.path && c.id === gooseCliToolId);
});
