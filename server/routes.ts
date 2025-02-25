import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCodeFileSchema, insertTestCaseSchema, insertChatMessageSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Code Files
  app.post("/api/files", async (req, res) => {
    const parsed = insertCodeFileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid file data" });
    }
    const file = await storage.createCodeFile(parsed.data);
    res.json(file);
  });

  app.get("/api/files", async (_req, res) => {
    const files = await storage.listCodeFiles();
    res.json(files);
  });

  app.get("/api/files/:id", async (req, res) => {
    const file = await storage.getCodeFile(Number(req.params.id));
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    res.json(file);
  });

  // Test Cases
  app.post("/api/files/:id/tests", async (req, res) => {
    const parsed = insertTestCaseSchema.safeParse({
      ...req.body,
      fileId: Number(req.params.id)
    });
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid test case data" });
    }
    const testCase = await storage.createTestCase(parsed.data);
    res.json(testCase);
  });

  app.get("/api/files/:id/tests", async (req, res) => {
    const testCases = await storage.getTestCases(Number(req.params.id));
    res.json(testCases);
  });

  // Chat Messages
  app.post("/api/files/:id/messages", async (req, res) => {
    const parsed = insertChatMessageSchema.safeParse({
      ...req.body,
      fileId: Number(req.params.id)
    });
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid message data" });
    }
    const message = await storage.createChatMessage(parsed.data);
    res.json(message);
  });

  app.get("/api/files/:id/messages", async (req, res) => {
    const messages = await storage.getChatMessages(Number(req.params.id));
    res.json(messages);
  });

  const httpServer = createServer(app);
  return httpServer;
}
