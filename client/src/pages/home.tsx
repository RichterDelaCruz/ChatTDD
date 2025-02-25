import { FileUpload } from "@/components/code/file-upload";
import { ProjectTree } from "@/components/code/project-tree";
import { ChatInterface } from "@/components/chat/chat-interface";
import { useState } from "react";
import { type CodeFile } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface FileWithPath extends CodeFile {
  path: string;
}

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFiles, setActiveFiles] = useState<FileWithPath[]>([]);

  const handleFileProcessed = (file: FileWithPath) => {
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
    setActiveFiles(prev => prev.filter(f => !f.path.startsWith(folderPath)));
  };

  const handleClearFiles = () => {
    setActiveFiles([]);
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
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Project Structure</h2>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleClearFiles}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear All Files
                  </Button>
                </div>
                <ProjectTree 
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