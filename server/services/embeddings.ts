import { Pinecone } from '@pinecone-database/pinecone';
import { Pipeline } from '@xenova/transformers';
import type { CodeFile } from '@shared/schema';

interface CodeChunk {
  fileId: number;
  content: string;
  startLine: number;
  endLine: number;
}

interface ChunkMetadata {
  fileId: number;
  content: string;
  startLine: number;
  endLine: number;
}

class EmbeddingsService {
  private pipeline: Pipeline | null = null;
  private pinecone: Pinecone | null = null;
  private indexName = 'code-context';
  private dimension = 384; // CodeBERT embedding dimension
  private initialized = false;

  constructor() {
    // Defer initialization until needed
    console.log('EmbeddingsService: Created instance');
  }

  private async ensureInitialized() {
    if (this.initialized) return;

    try {
      console.log('EmbeddingsService: Starting initialization');
      await this.initializePinecone();
      this.initialized = true;
      console.log('EmbeddingsService: Initialization complete');
    } catch (error) {
      console.error('EmbeddingsService: Initialization failed:', error);
      throw error;
    }
  }

  private async initializePinecone() {
    try {
      console.log('EmbeddingsService: Creating Pinecone client');
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!
      });

      // Parse environment string
      const envParts = process.env.PINECONE_ENVIRONMENT!.split('-');
      if (envParts.length !== 2) {
        throw new Error(`Invalid PINECONE_ENVIRONMENT format. Expected format: cloud-region, got: ${process.env.PINECONE_ENVIRONMENT}`);
      }
      const [cloud, region] = envParts;

      // Check if index exists
      console.log('EmbeddingsService: Checking for existing index');
      const indexList = await this.pinecone!.listIndexes();
      const exists = indexList.indexes?.some(index => index.name === this.indexName);

      if (!exists) {
        console.log('EmbeddingsService: Creating new index');
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: this.dimension,
          spec: {
            serverless: {
              cloud,
              region
            }
          }
        });
        console.log('EmbeddingsService: Index created successfully');
      } else {
        console.log('EmbeddingsService: Using existing index');
      }
    } catch (error) {
      console.error('EmbeddingsService: Pinecone initialization failed:', error);
      throw error;
    }
  }

  private async initializeModel() {
    if (this.pipeline) return;

    try {
      console.log('EmbeddingsService: Loading CodeBERT model');
      this.pipeline = await (Pipeline as any).fromPretrained(
        'Xenova/codebert-base',
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
    try {
      await this.initializeModel();
      if (!this.pipeline) throw new Error('Model not initialized');

      const output = await (this.pipeline as any).process(text, {
        pooling: 'mean',
        normalize: true
      });

      return Array.from(output.data);
    } catch (error) {
      console.error('EmbeddingsService: Embedding generation failed:', error);
      throw error;
    }
  }

  async addToIndex(file: CodeFile) {
    try {
      await this.ensureInitialized();

      console.log(`EmbeddingsService: Processing file ${file.id}`);
      const chunks = this.splitIntoChunks(file.content, file.id);
      const index = this.pinecone!.index(this.indexName);

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

      console.log(`EmbeddingsService: Successfully indexed ${chunks.length} chunks from file ${file.id}`);
    } catch (error) {
      console.error('EmbeddingsService: Failed to add file to index:', error);
      throw error;
    }
  }

  async findSimilarCode(query: string, k: number = 3): Promise<Array<{ fileId: number, content: string, similarity: number }>> {
    try {
      await this.ensureInitialized();

      console.log('EmbeddingsService: Generating query embedding');
      const queryEmbedding = await this.generateEmbedding(query);
      const index = this.pinecone!.index(this.indexName);

      console.log('EmbeddingsService: Querying Pinecone');
      const { matches } = await index.query({
        vector: queryEmbedding,
        topK: k,
        includeMetadata: true
      });

      if (!matches) return [];

      return matches.map(match => ({
        fileId: (match.metadata as ChunkMetadata).fileId,
        content: (match.metadata as ChunkMetadata).content,
        similarity: match.score || 0
      }));
    } catch (error) {
      console.error('EmbeddingsService: Failed to find similar code:', error);
      throw error;
    }
  }

  async clear() {
    try {
      await this.ensureInitialized();
      const index = this.pinecone!.index(this.indexName);
      await index.deleteAll();
      console.log('EmbeddingsService: Cleared all vectors from index');
    } catch (error) {
      console.error('EmbeddingsService: Failed to clear index:', error);
      throw error;
    }
  }
}

export const embeddingsService = new EmbeddingsService();