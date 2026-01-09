import type { components } from '@kortex-hub/mcp-registry-types';

// Augmented server response with validation status
export type ValidatedServerResponse = components['schemas']['ServerResponse'] & {
  isValidSchema: boolean;
};

// Augmented server list with validated servers
export type ValidatedServerList = Omit<components['schemas']['ServerList'], 'servers'> & {
  servers: ValidatedServerResponse[];
};

// our MCP server detail extends the MCP registry server detail with an id being URL of registry + server name encoded
export type MCPServerDetail = components['schemas']['ServerDetail'] & {
  serverId: string;
  isValidSchema?: boolean;
};

export interface MCPRemoteServerInfo {
  id: string;
  infos: { internalProviderId: string; serverId: string; remoteId: number };
  name: string;
  description: string;
  url: string;
  tools: Record<string, { description?: string }>;
  isValidSchema?: boolean;
}
