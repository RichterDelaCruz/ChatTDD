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
        await embeddingsService.addToIndex(updatedFile);
        
        // Broadcast change to all connected clients
        this.broadcastUpdate({
          type: 'FILE_UPDATED',
          payload: {
            fileName: update.name,
            fileId: updatedFile.id,
            version: updatedFile.version
          }
        });
      } else {
        // Create new file
        const newFile = await storage.createCodeFile({
          name: update.name,
          content: update.content,
          hash: update.hash,
          structure: { functions: [], classes: [] } // Basic structure, can be enhanced
        });

        await embeddingsService.addToIndex(newFile);
        
        this.broadcastUpdate({
          type: 'FILE_ADDED',
          payload: {
            fileName: update.name,
            fileId: newFile.id,
            version: 1
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
}
