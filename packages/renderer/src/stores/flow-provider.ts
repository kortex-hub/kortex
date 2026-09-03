import { derived } from 'svelte/store';

import { providerInfos } from './providers';

export const flowConnectionCount = derived(providerInfos, $providerInfos => {
  return $providerInfos.reduce((accumulator, current) => {
    return accumulator + current.flowConnections.length;
  }, 0);
});

export const isFlowConnectionAvailable = derived(flowConnectionCount, $flowConnectionCount => {
  return $flowConnectionCount > 0;
});
