import type { ModelInfo } from '/@/lib/chat/components/model-info';
import type { MCPConfigInfo } from '/@api/mcp/mcp-config-info';

export interface FlowCreationData {
  prompt: string;
  model: ModelInfo;
  mcp: MCPConfigInfo[];
}

/**
 * A state to temporarily hold the data for a new flow
 * when navigating from a chat session to the creation page.
 * It's set to `undefined` after being read to prevent stale data.
 */
export const flowCreationData = $state<{ value: FlowCreationData | undefined }>({ value: undefined });
