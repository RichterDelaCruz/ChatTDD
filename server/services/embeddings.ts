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
  private dimension = 3072; // text-embedding-3-large dimension
  private localChunks: CodeChunk[] = []; // Fallback local storage

  constructor() {
    console.log('EmbeddingsService: Created instance');
  }

  private async initializePinecone() {
    try {
      if (!process.env.PINECONE_API_KEY) {
        console.log('EmbeddingsService: Missing Pinecone API key, using local storage');
        return;
      }

      console.log('EmbeddingsService: Initializing Pinecone');
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
        hostUrl: 'https://thesis-magmipa.svc.aped-4627-b74a.pinecone.io'
      });

    } catch (error) {
      console.error('EmbeddingsService: Pinecone initialization failed:', error);
      console.log('EmbeddingsService: Falling back to local storage');
    }
  }

  private async initializeModel() {
    try {
      if (this.pipeline) return;

      console.log('EmbeddingsService: Loading text-embedding-3-large model');
      this.pipeline = await (Pipeline as any).fromPretrained(
        'Xenova/text-embedding-3-large',
        { task: 'feature-extraction' }
      );
      console.log('EmbeddingsService: Model loaded successfully');
    } catch (error) {
      console.error('EmbeddingsService: Model initialization failed:', error);
      throw error;
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

  private async generateEmbedding(text: string): Promise<number[]> {
    await this.initializeModel();
    if (!this.pipeline) throw new Error('Model not initialized');

    const output = await (this.pipeline as any).process(text, {
      pooling: 'mean',
      normalize: true
    });

    return Array.from(output.data);
  }

  private calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  async addToIndex(file: CodeFile) {
    try {
      await this.initializePinecone();
      console.log(`EmbeddingsService: Processing file ${file.id}`);

      const chunks = this.splitIntoChunks(file.content, file.id);

      if (this.pinecone) {
        const index = this.pinecone.index(this.indexName);

        // Process chunks in batches
        const batchSize = 10;
        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          console.log(`EmbeddingsService: Processing batch ${i / batchSize + 1}/${Math.ceil(chunks.length / batchSize)}`);

          const vectors = await Promise.all(
            batch.map(async (chunk, idx) => {
              const embedding = await this.generateEmbedding(chunk.content);
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
        // Fallback to local storage
        for (const chunk of chunks) {
          const embedding = await this.generateEmbedding(chunk.content);
          this.localChunks.push({
            ...chunk,
            embedding
          } as any);
        }
      }

      console.log(`EmbeddingsService: Successfully processed file ${file.id}`);
    } catch (error) {
      console.error('EmbeddingsService: Failed to process file:', error);
      throw error;
    }
  }

  async findSimilarCode(query: string, k: number = 3): Promise<Array<{ fileId: number, content: string, similarity: number }>> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      if (this.pinecone) {
        const index = this.pinecone.index(this.indexName);
        const { matches } = await index.query({
          vector: queryEmbedding,
          topK: k,
          includeMetadata: true
        });

        if (!matches) return [];

        return matches.map(match => ({
          fileId: match.metadata.fileId,
          content: match.metadata.content,
          similarity: match.score || 0
        }));
      } else {
        // Local similarity search
        const similarities = this.localChunks.map(chunk => ({
          chunk,
          similarity: this.calculateSimilarity(queryEmbedding, (chunk as any).embedding)
        }));

        return similarities
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, k)
          .map(({ chunk, similarity }) => ({
            fileId: chunk.fileId,
            content: chunk.content,
            similarity
          }));
      }
    } catch (error) {
      console.error('EmbeddingsService: Failed to find similar code:', error);
      throw error;
    }
  }

  async clear() {
    try {
      if (this.pinecone) {
        const index = this.pinecone.index(this.indexName);
        await index.deleteAll();
      }
      this.localChunks = [];
      console.log('EmbeddingsService: Cleared all vectors');
    } catch (error) {
      console.error('EmbeddingsService: Failed to clear vectors:', error);
      throw error;
    }
  }
}

export const embeddingsService = new EmbeddingsService();