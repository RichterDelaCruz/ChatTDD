import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCodeFileSchema, insertTestCaseSchema, insertChatMessageSchema } from "@shared/schema";
import { embeddingsService } from "./services/embeddings";
import fetch from "node-fetch";

const DEEPSEEK_API_ENDPOINT = "https://api.deepseek.com/v1/chat/completions";
const MAX_CONTEXT_LENGTH = 2000;
const MAX_SIMILAR_CHUNKS = 3;

export async function registerRoutes(app: Express): Promise<Server> {
  // Test endpoint to verify server is running
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Add this endpoint near the top of registerRoutes function
  app.post("/api/project/structure", async (req, res) => {
    try {
      const { files } = req.body;

      if (!Array.isArray(files)) {
        return res.status(400).json({ error: "Invalid project structure data" });
      }

      // Initialize folder structure in embeddings service
      try {
        await embeddingsService.initializeProjectStructure(files);
        res.json({ success: true });
      } catch (error) {
        console.error("Error initializing project structure:", error);
        res.status(500).json({ error: "Failed to analyze project structure" });
      }
    } catch (error) {
      console.error("Error processing project structure:", error);
      res.status(500).json({ error: "Failed to process project structure" });
    }
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
        const filePath = req.body.path || file.name;
        await embeddingsService.addToIndex(file, filePath);
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

  // Add DELETE endpoint for files
  app.delete("/api/files/:id", async (req, res) => {
    try {
      const fileId = Number(req.params.id);
      await storage.deleteCodeFile(fileId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: "Failed to delete file" });
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

  // Chat Messages (File Specific)
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

  app.delete("/api/files/:id/messages", async (req, res) => {
    try {
      const fileId = Number(req.params.id);
      // Clear messages for this file
      const messages = await storage.clearChatMessages(fileId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing messages:", error);
      res.status(500).json({ error: "Failed to clear messages" });
    }
  });


  // Chat Messages (Global)
  app.post("/api/chat/messages", async (req, res) => {
    try {
      const parsed = insertChatMessageSchema.safeParse({
        ...req.body,
        fileIds: req.body.fileIds || []
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

  app.get("/api/chat/messages", async (_req, res) => {
    try {
      const messages = await storage.getChatMessages();
      res.json(messages);
    } catch (error) {
      console.error("Error getting messages:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  app.delete("/api/chat/messages", async (_req, res) => {
    try {
      await storage.clearChatMessages();
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing messages:", error);
      res.status(500).json({ error: "Failed to clear messages" });
    }
  });

  // DeepSeek API Proxy with RAG
  app.post("/api/deepseek/generate", async (req, res) => {
    try {
      if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error("DEEPSEEK_API_KEY not configured");
      }

      // Get previous messages for context
      const previousMessages = await storage.getChatMessages();

      // Get files and build context
      let codeContext = "";
      let folderStructure = "";
      let filesAnalyzed: string[] = [];
      const files = req.body.fileIds?.length > 0 ? await Promise.all(
        req.body.fileIds.map(id => storage.getCodeFile(id))
      ) : [];

      if (req.body.fileIds?.length > 0) {
        try {
          // Get folder structure first
          folderStructure = await embeddingsService.getFolderStructure(req.body.fileIds);

          // Get similar code from selected files
          const similarCode = await embeddingsService.findSimilarCode(
            req.body.prompt,
            req.body.fileIds,
            MAX_SIMILAR_CHUNKS
          );

          // Format code context
          if (similarCode.length > 0) {
            codeContext = "Selected Files Context:\n\n" + similarCode
              .map(({ content, similarity, fileId }) => {
                const file = files.find(f => f.id === fileId);
                return `File: ${file?.name || 'Unknown'}\n` +
                       `Similarity: ${(similarity * 100).toFixed(1)}%\n` +
                       `Content:\n${content}\n`;
              })
              .join('\n---\n\n');
          }

          filesAnalyzed = files.filter(f => f).map(f => f!.name);

        } catch (error) {
          console.error("Error analyzing code:", error);
        }
      }

      const systemMessage = {
        role: "system",
        content: `You are a Test-Driven Development expert. Help users write high-quality test cases.

IMPORTANT INSTRUCTIONS:
1. Provide ONLY ONE test case at a time
2. NEVER include any code snippets in your responses
3. Structure your responses strictly in this format:

Test Description:
[Describe what aspect of the code this test case will verify]

Example/Expected Results:
[Describe the inputs and expected outputs or behavior in plain English]

Explanation:
[Explain the reasoning behind this test case and why it's important]

Selected Files:
${filesAnalyzed.length > 0 ? filesAnalyzed.join('\n') : 'No files selected'}

${folderStructure ? `\nProject Structure:\n${folderStructure}\n` : ''}
${codeContext ? `\nRelevant Code Context:\n${codeContext}` : ''}`
      };

      // Include previous conversation messages for context
      const messages = [
        systemMessage,
        ...previousMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: "user",
          content: req.body.prompt
        }
      ];

      // Add debug info about which files are being used
      res.write(`data: ${JSON.stringify({
        debug: {
          selectedFiles: filesAnalyzed,
          hasCodeContext: !!codeContext,
          hasFolderStructure: !!folderStructure
        }
      })}\n\n`);

      // Rest of the streaming response handling remains the same
      const requestBody = {
        model: "deepseek-coder",
        messages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: true
      };

      console.log("Sending request to DeepSeek with selected files:", filesAnalyzed);
      const response = await fetch(DEEPSEEK_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("DeepSeek API error:", errorText);
        throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error("No response body from DeepSeek API");
      }

      response.body.on('data', chunk => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              res.write('data: [DONE]\n\n');
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {
              console.error('Error parsing stream data:', e);
            }
          }
        }
      });

      response.body.on('end', () => {
        console.log("Stream ended");
        res.end();
      });

      response.body.on('error', error => {
        console.error("Stream error:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream processing error' });
        }
        res.end();
      });

    } catch (error: any) {
      console.error("Error in DeepSeek API route:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: error.message || "Failed to generate test case recommendations"
        });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}