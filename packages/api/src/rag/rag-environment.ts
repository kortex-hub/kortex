export interface RagEnvironment {
  name: string;
  ragConnection: {
    name: string;
    providerId: string;
  };
  chunkerId: string;
  indexedFiles: string[];
  pendingFiles: string[];
}
