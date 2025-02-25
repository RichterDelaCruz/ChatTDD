import { Pipeline } from '@xenova/transformers';
import { Pinecone } from '@pinecone-database/pinecone';
import type { CodeFile } from '@shared/schema';

interface CodeChunk {
  fileId: number;
  content: string;
  startLine: number;
  endLine: number;
  filePath: string;
  relatedFiles?: string[];
}

interface ProjectFile {
  name: string;
  path: string;
}

class EmbeddingsService {
  private pipeline: Pipeline | null = null;
  private pinecone: Pinecone | null = null;
  private indexName = 'thesis';
  private dimension = 3072;
  private localChunks: Array<CodeChunk & { embedding?: number[] }> = [];
  private fileRelationships: Map<string, Set<string>> = new Map();
  private projectStructure: Map<string, Set<string>> = new Map(); // Folder -> files mapping

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

      await this.pinecone.listIndexes();
      console.log('EmbeddingsService: Successfully connected to Pinecone');

    } catch (error) {
      console.error('EmbeddingsService: Pinecone initialization failed:', error);
      this.pinecone = null;
    }
  }

  private findRelatedFiles(content: string, filePath: string): string[] {
    const relatedFiles = new Set<string>();

    // Look for import statements
    const importMatches = content.matchAll(/(?:import|from)\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      relatedFiles.add(this.resolveImportPath(match[1], filePath));
    }

    // Look for require statements
    const requireMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
    for (const match of requireMatches) {
      relatedFiles.add(this.resolveImportPath(match[1], filePath));
    }

    return Array.from(relatedFiles);
  }

  private resolveImportPath(importPath: string, currentFilePath: string): string {
    // Basic path resolution logic
    if (importPath.startsWith('.')) {
      const parts = currentFilePath.split('/');
      parts.pop(); // Remove filename
      const importParts = importPath.split('/');

      for (const part of importParts) {
        if (part === '..') {
          parts.pop();
        } else if (part !== '.') {
          parts.push(part);
        }
      }

      return parts.join('/');
    }
    return importPath;
  }

  private splitIntoChunks(code: string, fileId: number, filePath: string): CodeChunk[] {
    const lines = code.split('\n');
    const chunkSize = 50;
    const chunks: CodeChunk[] = [];
    const relatedFiles = this.findRelatedFiles(code, filePath);

    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize);
      chunks.push({
        fileId,
        content: chunk.join('\n'),
        startLine: i + 1,
        endLine: Math.min(i + chunkSize, lines.length),
        filePath,
        relatedFiles
      });
    }

    // Update file relationships
    if (relatedFiles.length > 0) {
      this.fileRelationships.set(filePath, new Set(relatedFiles));
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

  async addToIndex(file: CodeFile, filePath: string) {
    try {
      console.log(`EmbeddingsService: Processing file ${file.id} at ${filePath}`);
      const chunks = this.splitIntoChunks(file.content, file.id, filePath);

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
                  endLine: chunk.endLine,
                  filePath: chunk.filePath,
                  relatedFiles: chunk.relatedFiles
                }
              };
            })
          );

          await index.upsert(vectors);
        }
      } else {
        console.log('EmbeddingsService: Using local storage for file', file.id);
        for (const chunk of chunks) {
          const embedding = await this.generateSimpleEmbedding(chunk.content);
          this.localChunks.push({ ...chunk, embedding });
        }
      }

      console.log(`EmbeddingsService: Successfully processed file ${file.id}`);
    } catch (error) {
      console.error('EmbeddingsService: Error processing file:', error);
      const chunks = this.splitIntoChunks(file.content, file.id, filePath);
      for (const chunk of chunks) {
        const embedding = await this.generateSimpleEmbedding(chunk.content);
        this.localChunks.push({ ...chunk, embedding });
      }
    }
  }

  async findSimilarCode(query: string, k: number = 3): Promise<Array<{ fileId: number, content: string, similarity: number }>> {
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

  async initializeProjectStructure(files: ProjectFile[]) {
    // Clear existing project structure
    this.projectStructure.clear();
    this.fileRelationships.clear();

    // Build folder structure
    for (const file of files) {
      const parts = file.path.split('/');
      const filename = parts.pop()!;
      let currentPath = '';

      // Build folder hierarchy
      for (const part of parts) {
        if (currentPath) {
          currentPath += '/' + part;
        } else {
          currentPath = part;
        }

        if (!this.projectStructure.has(currentPath)) {
          this.projectStructure.set(currentPath, new Set());
        }
      }

      // Add file to its immediate parent folder
      const parentFolder = parts.join('/');
      if (parentFolder) {
        this.projectStructure.get(parentFolder)?.add(filename);
      }
    }

    console.log('Project structure initialized:',
      Array.from(this.projectStructure.entries())
        .map(([folder, files]) => `${folder}: ${Array.from(files).join(', ')}`)
        .join('\n')
    );
  }


  async getFolderStructure(fileIds: number[]): Promise<string> {
    let result = "Project Structure:\n";

    // Add overall folder structure
    for (const [folder, files] of this.projectStructure.entries()) {
      const level = folder.split('/').length;
      const indent = "  ".repeat(level - 1);
      result += `${indent}/${folder}/\n`;
      files.forEach(file => {
        result += `${indent}  - ${file}\n`;
      });
    }

    // Add file relationships
    result += "\nFile Relationships:\n";
    for (const [filePath, related] of this.fileRelationships.entries()) {
      if (related.size > 0) {
        const filename = filePath.split('/').pop()!;
        result += `${filename} imports/requires:\n`;
        related.forEach(relPath => {
          result += `  - ${relPath}\n`;
        });
      }
    }

    return result;
  }
}

export const embeddingsService = new EmbeddingsService();