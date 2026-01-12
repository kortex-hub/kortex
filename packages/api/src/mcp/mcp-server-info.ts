import type { components } from '@kortex-hub/mcp-registry-types';

export type ValidatedServerDetail = components['schemas']['ServerDetail'] & {
  isValidSchema?: boolean;
};

export type ValidatedServerResponse = components['schemas']['ServerResponse'] & {
  server: ValidatedServerDetail;
};

// Augmented server list with validated servers
export type ValidatedServerList = Omit<components['schemas']['ServerList'], 'servers'> & {
  servers: ValidatedServerResponse[];
};

// our MCP server detail extends the MCP registry server detail with an id being URL of registry + server name encoded
export type MCPServerDetail = ValidatedServerDetail & {
  serverId: string;
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
