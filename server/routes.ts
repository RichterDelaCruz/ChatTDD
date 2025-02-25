import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCodeFileSchema, insertTestCaseSchema, insertChatMessageSchema } from "@shared/schema";
import fetch from "node-fetch";

const DEEPSEEK_API_ENDPOINT = "https://api.deepseek.com/v1/completions";

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

  // DeepSeek API Proxy
  app.post("/api/deepseek/generate", async (req, res) => {
    try {
      const response = await fetch(DEEPSEEK_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-coder",
          messages: [{
            role: "system",
            content: "You are a Test-Driven Development expert. Generate test cases that help verify functionality. Focus on edge cases, error conditions, and important behavioral aspects. DO NOT provide implementation code."
          }, {
            role: "user",
            content: req.body.prompt
          }],
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      let error;
      try {
        const errorData = await response.text();
        error = JSON.parse(errorData);
      } catch {
        error = { message: "Failed to parse API response" };
      }

      if (!response.ok) {
        throw new Error(error.message || response.statusText);
      }

      // Parse response as text first to handle potential JSON errors
      const responseText = await response.text();
      const data = JSON.parse(responseText);
      res.json(data);
    } catch (error: any) {
      console.error("Error calling DeepSeek API:", error);
      res.status(500).json({ 
        error: error.message || "Failed to generate test case recommendations"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}