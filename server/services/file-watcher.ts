/**
 * VSCode Extension Integration Protocol:
 * 
 * WebSocket URL: ws://[server]/ws/file-updates
 * 
 * Message Format:
 * {
 *   name: string;        // File name with path
 *   content: string;     // File content
 *   hash: string;        // SHA-256 hash of content
 * }
 * 
 * Server Responses:
 * {
 *   type: 'FILE_UPDATED' | 'FILE_ADDED';
 *   payload: {
 *     fileName: string;
 *     fileId: number;
 *     version: number;
 *     hash: string;
 *   }
 * }
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { storage } from '../storage';
import type { FileUpdate } from '@shared/schema';
import { embeddingsService } from './embeddings';
import crypto from 'crypto';

export class FileWatcherService {
  private wss: WebSocketServer;
  private fileVersions: Map<string, string> = new Map(); // filename -> hash

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws/file-updates' 
    });

    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('New file watcher client connected');

      ws.on('message', async (data) => {
        try {
          const update = JSON.parse(data.toString()) as FileUpdate;
          await this.handleFileUpdate(update);
        } catch (error) {
          console.error('Error handling file update:', error);
        }
      });

      ws.on('close', () => {
        console.log('File watcher client disconnected');
      });
    });
  }

  private async handleFileUpdate(update: FileUpdate) {
    const currentHash = this.fileVersions.get(update.name);

    // Only process if file has changed
    if (currentHash !== update.hash) {
      console.log(`File ${update.name} has changed, updating...`);

      const existingFile = await storage.findCodeFileByName(update.name);

      if (existingFile) {
        // Update existing file
        const updatedFile = await storage.updateCodeFile({
          id: existingFile.id,
          content: update.content,
          hash: update.hash,
        });

        // Update embeddings
        await embeddingsService.addToIndex(updatedFile, update.name);

        // Broadcast change to all connected clients
        this.broadcastUpdate({
          type: 'FILE_UPDATED',
          payload: {
            fileName: update.name,
            fileId: updatedFile.id,
            version: updatedFile.version,
            hash: update.hash
          }
        });
      } else {
        // Create new file
        const newFile = await storage.createCodeFile({
          name: update.name,
          content: update.content,
          hash: update.hash,
          structure: this.analyzeCode(update.content, update.name)
        });

        await embeddingsService.addToIndex(newFile, update.name);

        this.broadcastUpdate({
          type: 'FILE_ADDED',
          payload: {
            fileName: update.name,
            fileId: newFile.id,
            version: 1,
            hash: update.hash
          }
        });
      }

      this.fileVersions.set(update.name, update.hash);
    }
  }

  private broadcastUpdate(message: any) {
    const messageStr = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  // Utility function to generate file hash
  public static generateFileHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // Function to analyze code structure
  private analyzeCode(content: string, fileName: string) {
    const structure = {
      functions: [] as { name: string; line: number }[],
      classes: [] as { name: string; line: number }[]
    };

    const lines = content.split('\n');
    const fileType = fileName.split('.').pop()?.toLowerCase();

    let funcPattern = /function\s+(\w+)/g;
    let classPattern = /class\s+(\w+)/g;

    switch (fileType) {
      case 'py':
        funcPattern = /def\s+(\w+)/g;
        break;
      case 'ts':
      case 'tsx':
        funcPattern = /(function\s+(\w+)|const\s+(\w+)\s*=\s*(\([^)]*\)\s*=>|\([^)]*\)\s*{))/g;
        break;
    }

    let match;
    while ((match = funcPattern.exec(content)) !== null) {
      structure.functions.push({
        name: match[1] || match[3],
        line: content.slice(0, match.index).split('\n').length
      });
    }

    while ((match = classPattern.exec(content)) !== null) {
      structure.classes.push({
        name: match[1],
        line: content.slice(0, match.index).split('\n').length
      });
    }

    return structure;
  }
}