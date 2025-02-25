import { FileUpload } from "@/components/code/file-upload";
import { ChatInterface } from "@/components/chat/chat-interface";
import { FolderTree } from "@/components/code/folder-tree";
import { useState } from "react";
import { type CodeFile } from "@shared/schema";
import { Card } from "@/components/ui/card";

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

  const handleRemoveFolder = (folderPath: string) => {
    setActiveFiles(prev => 
      prev.filter(file => {
        const filePath = file.path || file.name;
        return !filePath.startsWith(folderPath + '/') && filePath !== folderPath;
      })
    );
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
              <Card className="p-6">
                <FolderTree 
                  files={activeFiles}
                  onRemoveFile={handleRemoveFile}
                  onRemoveFolder={handleRemoveFolder}
                />
              </Card>
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