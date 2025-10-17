export interface RagEnvironment {
  name: string;
  ragConnectionId: string;
  chunkerId: string;
  indexedFiles: string[];
  pendingFiles: string[];
}
