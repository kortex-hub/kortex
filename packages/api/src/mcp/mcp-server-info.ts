import type { components } from '@kortex-hub/mcp-registry-types';

// our MCP server detail extends the MCP registry server detail with an id being URL of registry + server name encoded
export type MCPServerDetail = components['schemas']['ServerDetail'] & { serverId: string };
