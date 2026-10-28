export interface StoredDocument {
  id: string;
  fileName: string;
  originalName: string;
  uploadedAt: string;
  contentLength: number;
  chunkCount: number;
}

export interface StoredChunk {
  id: string;
  documentId: string;
  documentName: string;
  text: string;
  embedding: number[];
}

export interface KnowledgeBase {
  documents: StoredDocument[];
  chunks: StoredChunk[];
}

export interface SearchMatch {
  chunkId: string;
  documentId: string;
  documentName: string;
  score: number;
  text: string;
}

