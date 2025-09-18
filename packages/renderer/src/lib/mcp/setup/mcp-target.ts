import type { components } from 'mcp-registry';

export type MCPTarget = (components['schemas']['Remote'] | components['schemas']['Package']) & { index: number };
