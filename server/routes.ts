import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCodeFileSchema, insertTestCaseSchema, insertChatMessageSchema } from "@shared/schema";
import { embeddingsService } from "./services/embeddings";

const DEEPSEEK_API_ENDPOINT = "https://api.deepseek.com/v1/chat/completions";
const MAX_CONTEXT_LENGTH = 2000;
const MAX_SIMILAR_CHUNKS = 3;

export async function registerRoutes(app: Express): Promise<Server> {
  // Test endpoint to verify server is running
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Code Files
  app.post("/api/files", async (req, res) => {
    try {
      console.log("Processing file upload request");
      const parsed = insertCodeFileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid file data" });
      }
      const file = await storage.createCodeFile(parsed.data);

      // Index the file for similarity search
      try {
        await embeddingsService.addToIndex(file);
      } catch (error) {
        console.error("Failed to index file:", error);
        // Continue anyway since the file is saved
      }

      res.json(file);
    } catch (error) {
      console.error("Error creating file:", error);
      res.status(500).json({ error: "Failed to create file" });
    }
  });

  app.get("/api/files", async (_req, res) => {
    try {
      const files = await storage.listCodeFiles();
      res.json(files);
    } catch (error) {
      console.error("Error listing files:", error);
      res.status(500).json({ error: "Failed to list files" });
    }
  });

  app.get("/api/files/:id", async (req, res) => {
    try {
      const file = await storage.getCodeFile(Number(req.params.id));
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (error) {
      console.error("Error getting file:", error);
      res.status(500).json({ error: "Failed to get file" });
    }
  });

  // Test Cases
  app.post("/api/files/:id/tests", async (req, res) => {
    try {
      const parsed = insertTestCaseSchema.safeParse({
        ...req.body,
        fileId: Number(req.params.id)
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid test case data" });
      }
      const testCase = await storage.createTestCase(parsed.data);
      res.json(testCase);
    } catch (error) {
      console.error("Error creating test case:", error);
      res.status(500).json({ error: "Failed to create test case" });
    }
  });

  app.get("/api/files/:id/tests", async (req, res) => {
    try {
      const testCases = await storage.getTestCases(Number(req.params.id));
      res.json(testCases);
    } catch (error) {
      console.error("Error getting test cases:", error);
      res.status(500).json({ error: "Failed to get test cases" });
    }
  });

  // Chat Messages
  app.post("/api/files/:id/messages", async (req, res) => {
    try {
      const parsed = insertChatMessageSchema.safeParse({
        ...req.body,
        fileId: Number(req.params.id)
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid message data" });
      }
      const message = await storage.createChatMessage(parsed.data);
      res.json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  app.get("/api/files/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getChatMessages(Number(req.params.id));
      res.json(messages);
    } catch (error) {
      console.error("Error getting messages:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  // DeepSeek API Proxy with RAG (temporarily disabled for debugging)
  app.post("/api/deepseek/generate", async (req, res) => {
    try {
      // Temporary simple response for testing
      res.json({
        choices: [{
          message: {
            content: "Server is functioning correctly. DeepSeek integration temporarily disabled for debugging."
          }
        }]
      });
    } catch (error: any) {
      console.error("Error in test endpoint:", error);
      res.status(500).json({
        error: "Server test endpoint error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}