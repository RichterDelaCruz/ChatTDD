import { Pipeline } from '@xenova/transformers';
import { Pinecone } from '@pinecone-database/pinecone';
import type { CodeFile } from '@shared/schema';

interface CodeChunk {
  fileId: number;
  content: string;
  startLine: number;
  endLine: number;
}

class EmbeddingsService {
  private pipeline: Pipeline | null = null;
  private pinecone: Pinecone | null = null;
  private indexName = 'thesis';
  private dimension = 3072;
  private localChunks: Array<CodeChunk & { embedding?: number[] }> = [];

  constructor() {
    console.log('EmbeddingsService: Created instance');
    this.initializePinecone().catch(err => {
      console.error('EmbeddingsService: Pinecone initialization failed:', err);
      console.log('EmbeddingsService: Using local storage fallback');
    });
  }

  private async initializePinecone() {
    try {
      if (!process.env.PINECONE_API_KEY) {
        console.log('EmbeddingsService: Missing Pinecone API key, using local storage');
        return;
      }

      console.log('EmbeddingsService: Initializing Pinecone client');
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });

      // Test connection by listing indexes
      await this.pinecone.listIndexes();
      console.log('EmbeddingsService: Successfully connected to Pinecone');

    } catch (error) {
      console.error('EmbeddingsService: Pinecone initialization failed:', error);
      this.pinecone = null; // Ensure we use local storage
    }
  }

  private splitIntoChunks(code: string, fileId: number): CodeChunk[] {
    const lines = code.split('\n');
    const chunkSize = 50;
    const chunks: CodeChunk[] = [];

    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize);
      chunks.push({
        fileId,
        content: chunk.join('\n'),
        startLine: i + 1,
        endLine: Math.min(i + chunkSize, lines.length)
      });
    }

    return chunks;
  }

  private async generateSimpleEmbedding(text: string): Promise<number[]> {
    // Generate a simple term frequency vector
    const words = text.toLowerCase().split(/\W+/);
    const freq = new Map<string, number>();

    words.forEach(word => {
      freq.set(word, (freq.get(word) || 0) + 1);
    });

    // Convert frequencies to vector
    const values = Array.from(freq.values());
    const sum = values.reduce((a, b) => a + b, 0);
    const normalized = values.map(v => v / sum);

    // Pad or truncate to match expected dimension
    const padding = Array(this.dimension - normalized.length).fill(0);
    return [...normalized, ...padding].slice(0, this.dimension);
  }

  private calculateSimilarity(v1: number[], v2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2) || 1);
  }

  async addToIndex(file: CodeFile) {
    try {
      console.log(`EmbeddingsService: Processing file ${file.id}`);
      const chunks = this.splitIntoChunks(file.content, file.id);

      if (this.pinecone) {
        const index = this.pinecone.Index(this.indexName);
        const batchSize = 10;

        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);

          const vectors = await Promise.all(
            batch.map(async (chunk, idx) => {
              const embedding = await this.generateSimpleEmbedding(chunk.content);
              return {
                id: `${file.id}-${i + idx}`,
                values: embedding,
                metadata: {
                  fileId: chunk.fileId,
                  content: chunk.content,
                  startLine: chunk.startLine,
                  endLine: chunk.endLine
                }
              };
            })
          );

          await index.upsert(vectors);
        }
      } else {
        // Local storage fallback
        console.log('EmbeddingsService: Using local storage for file', file.id);
        for (const chunk of chunks) {
          const embedding = await this.generateSimpleEmbedding(chunk.content);
          this.localChunks.push({ ...chunk, embedding });
        }
      }

      console.log(`EmbeddingsService: Successfully processed file ${file.id}`);
    } catch (error) {
      console.error('EmbeddingsService: Error processing file:', error);
      // Always fall back to local storage on error
      const chunks = this.splitIntoChunks(file.content, file.id);
      for (const chunk of chunks) {
        const embedding = await this.generateSimpleEmbedding(chunk.content);
        this.localChunks.push({ ...chunk, embedding });
      }
    }
  }

  async findSimilarCode(query: string, k: number = 2): Promise<Array<{ fileId: number, content: string, similarity: number }>> {
    try {
      const queryEmbedding = await this.generateSimpleEmbedding(query);

      if (this.pinecone) {
        try {
          const index = this.pinecone.Index(this.indexName);
          const { matches } = await index.query({
            vector: queryEmbedding,
            topK: k,
            includeMetadata: true
          });

          if (!matches) return [];

          return matches.map(match => ({
            fileId: match.metadata.fileId as number,
            content: match.metadata.content as string,
            similarity: match.score || 0
          }));
        } catch (error) {
          console.error('EmbeddingsService: Pinecone query failed, falling back to local:', error);
          // Fall through to local search
        }
      }

      // Local similarity search
      const similarities = this.localChunks.map(chunk => ({
        chunk,
        similarity: chunk.embedding ?
          this.calculateSimilarity(queryEmbedding, chunk.embedding) :
          0
      }));

      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, k)
        .map(({ chunk, similarity }) => ({
          fileId: chunk.fileId,
          content: chunk.content,
          similarity
        }));

    } catch (error) {
      console.error('EmbeddingsService: Error finding similar code:', error);
      return [];
    }
  }

  async clear() {
    try {
      if (this.pinecone) {
        const index = this.pinecone.Index(this.indexName);
        await index.deleteAll();
      }
      this.localChunks = [];
      console.log('EmbeddingsService: Cleared all vectors');
    } catch (error) {
      console.error('EmbeddingsService: Error clearing vectors:', error);
      this.localChunks = [];
    }
  }
}

export const embeddingsService = new EmbeddingsService();