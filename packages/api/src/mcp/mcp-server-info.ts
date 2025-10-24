import type { components } from '@kortex-hub/mcp-registry-types';
import { z } from 'zod';

// our MCP server detail extends the MCP registry server detail with an id being URL of registry + server name encoded
export type MCPServerDetail = components['schemas']['ServerDetail'] & { serverId: string };

export interface MCPRemoteServerInfo {
  id: string;
  infos: { internalProviderId: string; serverId: string; remoteId: number };
  name: string;
  description: string;
  url: string;
}

// Zod schema matching the OpenAPI ServerDetail type
const MCPServerDetailSchema = z.object({
  // Required fields per OpenAPI spec
  name: z.string(),
  description: z.string(),
  version: z.string(),
  // Optional but used fields
  remotes: z
    .array(
      z.object({
        type: z.enum(['streamable-http', 'sse']),
        url: z.string(),
      }),
    )
    .optional(),
});

// Zod schema matching the OpenAPI ServerResponse type
const MCPServerResponseSchema = z.object({
  server: MCPServerDetailSchema,
  _meta: z.record(z.string(), z.any()), // Required field per OpenAPI spec
});

// Zod schema matching the OpenAPI ServerList type
export const MCPServerListSchema = z.object({
  servers: z.array(MCPServerResponseSchema),
  metadata: z
    .object({
      nextCursor: z.string().optional(),
    })
    .optional(),
});
