import { FileUpload } from "@/components/code/file-upload";
import { ChatInterface } from "@/components/chat/chat-interface";
import { useState } from "react";
import { type CodeFile } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFiles, setActiveFiles] = useState<CodeFile[]>([]);

  const handleFileProcessed = (file: CodeFile) => {
    setActiveFiles(prev => {
      // Check if file already exists
      const exists = prev.some(f => f.id === file.id);
      if (exists) return prev;
      return [...prev, file];
    });
  };

  const handleRemoveFile = (fileId: number) => {
    setActiveFiles(prev => prev.filter(f => f.id !== fileId));
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-foreground">
          TDD Code Assistant
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Card className="p-6">
              <FileUpload 
                onFileSelected={handleFileProcessed}
                onProcessingStateChange={setIsProcessing}
              />
            </Card>

            {activeFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Active Codebase Files:</p>
                {activeFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">{file.name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(file.id)}
                      className="hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Card className="p-6">
              <ChatInterface 
                activeFileIds={activeFiles.map(f => f.id)} 
                isProcessingFiles={isProcessing}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}