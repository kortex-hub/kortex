import type { components } from '@kortex-hub/mcp-registry-types';

export type MCPTarget = (components['schemas']['Remote'] | components['schemas']['Package']) & { index: number };
