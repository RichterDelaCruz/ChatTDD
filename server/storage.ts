import { 
  type CodeFile, type InsertCodeFile,
  type TestCase, type InsertTestCase,
  type ChatMessage, type InsertChatMessage
} from "@shared/schema";

export interface IStorage {
  // Code Files
  getCodeFile(id: number): Promise<CodeFile | undefined>;
  createCodeFile(file: InsertCodeFile): Promise<CodeFile>;
  listCodeFiles(): Promise<CodeFile[]>;

  // Test Cases
  getTestCases(fileId: number): Promise<TestCase[]>;
  createTestCase(testCase: InsertTestCase): Promise<TestCase>;

  // Chat Messages
  getChatMessages(fileId: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  clearChatMessages(fileId: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private codeFiles: Map<number, CodeFile>;
  private testCases: Map<number, TestCase>;
  private chatMessages: Map<number, ChatMessage>;
  private currentId: { [key: string]: number };

  constructor() {
    this.codeFiles = new Map();
    this.testCases = new Map();
    this.chatMessages = new Map();
    this.currentId = { codeFiles: 1, testCases: 1, chatMessages: 1 };
  }

  async getCodeFile(id: number): Promise<CodeFile | undefined> {
    return this.codeFiles.get(id);
  }

  async createCodeFile(file: InsertCodeFile): Promise<CodeFile> {
    const id = this.currentId.codeFiles++;
    const codeFile: CodeFile = { ...file, id };
    this.codeFiles.set(id, codeFile);
    return codeFile;
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

  async getChatMessages(fileId: number): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter(msg => msg.fileId === fileId)
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

  async clearChatMessages(fileId: number): Promise<void> {
    // Remove all messages for this file
    for (const [id, message] of this.chatMessages.entries()) {
      if (message.fileId === fileId) {
        this.chatMessages.delete(id);
      }
    }
  }
}

export const storage = new MemStorage();