export interface RagEnvironmentInfo {
  name: string;
  ragConnection?: {
    id: string;
    name: string;
    provider: {
      id: string;
    }
  }
  chunker?: {
    id: string;
    name: string;
    provider: {
      id: string;
    }
  }
  indexedFiles: string[];
  pendingFiles: string[];
}
