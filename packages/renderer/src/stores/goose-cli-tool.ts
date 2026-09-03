import { derived } from 'svelte/store';

import { cliToolInfos } from './cli-tools';

const gooseCliToolId = 'kaiden.goose.goose';

export const gooseCliTool = derived(cliToolInfos, $cliToolInfos => {
  return $cliToolInfos.find(c => c.id === gooseCliToolId);
});
