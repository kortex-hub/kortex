import type { components } from '@kortex-hub/mcp-registry-types';

// our MCP server detail extends the MCP registry server detail with an id being URL of registry + server name encoded
export type MCPServerDetail = components['schemas']['ServerDetail'] & {
  serverId: string;
  hasInvalidSchema?: boolean;
};

export interface MCPRemoteServerInfo {
  id: string;
  infos: { internalProviderId: string; serverId: string; remoteId: number };
  name: string;
  description: string;
  url: string;
  tools: Record<string, { description?: string }>;
}
