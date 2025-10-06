import type { ModelInfo } from '/@/lib/chat/components/model-info';
import type { FlowGenerationParameters } from '/@api/chat/flow-generation-parameters-schema';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';

export interface FlowCreationData extends FlowGenerationParameters {
  model: ModelInfo;
  mcp: MCPRemoteServerInfo[];
}

/**
 * A state to temporarily hold the data for a new flow
 * when navigating from a chat session to the creation page.
 * It's set to `undefined` after being read to prevent stale data.
 */
export const flowCreationData = $state<{ value: FlowCreationData | undefined }>({ value: undefined });
