import type { MCPRemoteServerInfo } from '../mcp/mcp-server-info.js';

export interface RagEnvironment {
  name: string;
  ragConnection: {
    name: string;
    providerId: string;
  };
  chunkerId: string;
  indexedFiles: string[];
  pendingFiles: string[];
  mcpServer?: MCPRemoteServerInfo;
}
