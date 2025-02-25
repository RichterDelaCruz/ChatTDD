import { pgTable, text, serial, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const codeFiles = pgTable("code_files", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  hash: text("hash").notNull(), // For tracking file changes
  version: integer("version").notNull().default(1),
  lastUpdated: timestamp("last_updated").defaultNow(),
  structure: jsonb("structure").notNull().$type<{
    functions: Array<{ name: string; line: number }>;
    classes: Array<{ name: string; line: number }>;
  }>(),
});

export const testCases = pgTable("test_cases", {
  id: serial("id").primaryKey(),
  fileId: serial("file_id").references(() => codeFiles.id),
  description: text("description").notNull(),
  testCode: text("test_code").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  fileIds: integer("file_ids").array(), // Now stores an array of file IDs
  role: text("role").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertCodeFileSchema = createInsertSchema(codeFiles).omit({ 
  id: true, 
  version: true,
  lastUpdated: true 
});

export const insertTestCaseSchema = createInsertSchema(testCases).omit({ 
  id: true, 
  createdAt: true 
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ 
  id: true, 
  timestamp: true
});

export type CodeFile = typeof codeFiles.$inferSelect;
export type InsertCodeFile = z.infer<typeof insertCodeFileSchema>;
export type TestCase = typeof testCases.$inferSelect;
export type InsertTestCase = z.infer<typeof insertTestCaseSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// Utility type for file updates
export type FileUpdate = {
  name: string;
  content: string;
  hash: string;
};