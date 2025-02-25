import type { CodeFile } from '@shared/schema';

class EmbeddingsService {
  private codeMap: Map<number, { fileId: number, content: string }> = new Map();

  async addToIndex(file: CodeFile) {
    const indexId = this.codeMap.size;
    this.codeMap.set(indexId, {
      fileId: file.id,
      content: file.content
    });
  }

  // Simple cosine similarity between two strings
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\W+/));
    const words2 = new Set(text2.toLowerCase().split(/\W+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));

    if (words1.size === 0 || words2.size === 0) return 0;

    return intersection.size / Math.sqrt(words1.size * words2.size);
  }

  async findSimilarCode(query: string, k: number = 3): Promise<Array<{ fileId: number, content: string, similarity: number }>> {
    const results = Array.from(this.codeMap.values()).map(file => ({
      ...file,
      similarity: this.calculateSimilarity(query, file.content)
    }));

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  clear() {
    this.codeMap.clear();
  }
}

export const embeddingsService = new EmbeddingsService();