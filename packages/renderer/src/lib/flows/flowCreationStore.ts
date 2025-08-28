import { writable } from 'svelte/store';

import type { ModelInfo } from '/@/lib/chat/components/model-info';

export interface FlowCreationData {
  prompt: string;
  model: ModelInfo;
  mcp: Set<string>;
}

/**
 * A writable store to temporarily hold the data for a new flow
 * when navigating from a chat session to the creation page.
 * It's set to `undefined` after being read to prevent stale data.
 */
export const flowCreationStore = writable<FlowCreationData | undefined>();
