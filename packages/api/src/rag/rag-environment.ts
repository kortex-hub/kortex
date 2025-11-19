import type { MCPRemoteServerInfo } from '../mcp/mcp-server-info.js';

export interface FileInfo {
  path: string;
  status: 'pending' | 'indexed';
}
export interface RagEnvironment {
  name: string;
  ragConnection: {
    name: string;
    providerId: string;
  };
  chunkerId: string;
  files: FileInfo[];
  mcpServer?: MCPRemoteServerInfo;
}
