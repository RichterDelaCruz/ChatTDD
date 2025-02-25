import type { CodeFile } from '@shared/schema';

interface CodeChunk {
  fileId: number;
  content: string;
  startLine: number;
  endLine: number;
}

class EmbeddingsService {
  private codeChunks: CodeChunk[] = [];

  // Split code into smaller chunks for more efficient similarity search
  private splitIntoChunks(code: string, fileId: number): CodeChunk[] {
    const lines = code.split('\n');
    const chunkSize = 50; // Adjust based on your needs
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

  async addToIndex(file: CodeFile) {
    const chunks = this.splitIntoChunks(file.content, file.id);
    this.codeChunks.push(...chunks);
  }

  // Improved similarity calculation using TF-IDF inspired approach
  private calculateSimilarity(text1: string, text2: string): number {
    const tokenize = (text: string) => {
      return text.toLowerCase()
        .split(/\W+/)
        .filter(word => word.length > 2); // Filter out very short words
    };

    const words1 = tokenize(text1);
    const words2 = tokenize(text2);

    // Create word frequency maps
    const freq1 = new Map<string, number>();
    const freq2 = new Map<string, number>();

    words1.forEach(word => freq1.set(word, (freq1.get(word) || 0) + 1));
    words2.forEach(word => freq2.set(word, (freq2.get(word) || 0) + 1));

    // Calculate dot product
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    // Use all unique words from both texts
    const allWords = new Set([...freq1.keys(), ...freq2.keys()]);

    allWords.forEach(word => {
      const f1 = freq1.get(word) || 0;
      const f2 = freq2.get(word) || 0;
      dotProduct += f1 * f2;
      norm1 += f1 * f1;
      norm2 += f2 * f2;
    });

    // Return cosine similarity
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2) || 1);
  }

  async findSimilarCode(query: string, k: number = 3): Promise<Array<{ fileId: number, content: string, similarity: number }>> {
    // Calculate similarities for each chunk
    const results = this.codeChunks.map(chunk => ({
      fileId: chunk.fileId,
      content: chunk.content,
      similarity: this.calculateSimilarity(query, chunk.content)
    }));

    // Sort by similarity and take top k unique files
    const seenFileIds = new Set<number>();
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .filter(result => {
        if (seenFileIds.has(result.fileId)) return false;
        seenFileIds.add(result.fileId);
        return true;
      })
      .slice(0, k);
  }

  clear() {
    this.codeChunks = [];
  }
}

export const embeddingsService = new EmbeddingsService();