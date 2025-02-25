import {
  type CodeFile, type InsertCodeFile,
  type TestCase, type InsertTestCase,
  type ChatMessage, type InsertChatMessage
} from "@shared/schema";

export interface IStorage {
  // Code Files
  getCodeFile(id: number): Promise<CodeFile | undefined>;
  findCodeFileByName(name: string): Promise<CodeFile | undefined>;
  createCodeFile(file: InsertCodeFile): Promise<CodeFile>;
  updateCodeFile(update: { id: number; content: string; hash: string }): Promise<CodeFile>;
  listCodeFiles(): Promise<CodeFile[]>;

  // Test Cases
  getTestCases(fileId: number): Promise<TestCase[]>;
  createTestCase(testCase: InsertTestCase): Promise<TestCase>;

  // Chat Messages (Global)
  getChatMessages(): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  clearChatMessages(): Promise<void>;
}

export class MemStorage implements IStorage {
  private codeFiles: Map<number, CodeFile>;
  private testCases: Map<number, TestCase>;
  private chatMessages: Map<number, ChatMessage>;
  private currentId: { [key: string]: number };
  private fileNameToId: Map<string, number>;

  constructor() {
    this.codeFiles = new Map();
    this.testCases = new Map();
    this.chatMessages = new Map();
    this.currentId = { codeFiles: 1, testCases: 1, chatMessages: 1 };
    this.fileNameToId = new Map();
  }

  async getCodeFile(id: number): Promise<CodeFile | undefined> {
    return this.codeFiles.get(id);
  }

  async findCodeFileByName(name: string): Promise<CodeFile | undefined> {
    const fileId = this.fileNameToId.get(name);
    if (fileId) {
      return this.codeFiles.get(fileId);
    }
    return undefined;
  }

  async createCodeFile(file: InsertCodeFile): Promise<CodeFile> {
    const id = this.currentId.codeFiles++;
    const codeFile: CodeFile = {
      ...file,
      id,
      version: 1,
      lastUpdated: new Date()
    };
    this.codeFiles.set(id, codeFile);
    this.fileNameToId.set(file.name, id);
    return codeFile;
  }

  async updateCodeFile(update: { id: number; content: string; hash: string }): Promise<CodeFile> {
    const file = await this.getCodeFile(update.id);
    if (!file) {
      throw new Error(`File with id ${update.id} not found`);
    }

    const updatedFile: CodeFile = {
      ...file,
      content: update.content,
      hash: update.hash,
      version: file.version + 1,
      lastUpdated: new Date()
    };

    this.codeFiles.set(update.id, updatedFile);
    return updatedFile;
  }

  async listCodeFiles(): Promise<CodeFile[]> {
    return Array.from(this.codeFiles.values());
  }

  async getTestCases(fileId: number): Promise<TestCase[]> {
    return Array.from(this.testCases.values())
      .filter(test => test.fileId === fileId);
  }

  async createTestCase(testCase: InsertTestCase): Promise<TestCase> {
    const id = this.currentId.testCases++;
    const newTestCase: TestCase = {
      ...testCase,
      id,
      createdAt: new Date()
    };
    this.testCases.set(id, newTestCase);
    return newTestCase;
  }

  async getChatMessages(): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const id = this.currentId.chatMessages++;
    const chatMessage: ChatMessage = {
      ...message,
      id,
      timestamp: new Date()
    };
    this.chatMessages.set(id, chatMessage);
    return chatMessage;
  }

  async clearChatMessages(): Promise<void> {
    this.chatMessages.clear();
  }
}

export const storage = new MemStorage();