import type { UIMessage } from 'ai';

export interface InferenceParameters {
  providerId: string;
  connectionName: string;
  modelId: string;
  mcp: string[];
  messages: UIMessage[];
}
