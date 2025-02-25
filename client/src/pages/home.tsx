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
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());

  const handleFileProcessed = (file: FileWithPath) => {
    setActiveFiles(prev => {
      // Check if file already exists
      const exists = prev.some(f => f.id === file.id);
      if (exists) return prev;
      return [...prev, file];
    });
  };

  const handleFileSelect = (fileId: number, selected: boolean) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(fileId);
      } else {
        next.delete(fileId);
      }
      return next;
    });
  };

  const handleClearFiles = () => {
    setActiveFiles([]);
    setSelectedFiles(new Set());
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">
            ChatTDD
          </h1>
          <p className="text-muted-foreground">
            Test-Driven Development Assistant powered by AI
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Card className="p-6">
              <FileUpload 
                onFileSelected={handleFileProcessed}
                onProcessingStateChange={setIsProcessing}
                disabled={activeFiles.length > 0}
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
                    Clear Project
                  </Button>
                </div>
                <ProjectTree 
                  files={activeFiles}
                  selectedFiles={selectedFiles}
                  onFileSelect={handleFileSelect}
                />
              </Card>
            )}
          </div>

          <div>
            <Card className="p-6">
              <ChatInterface 
                activeFileIds={Array.from(selectedFiles)} 
                isProcessingFiles={isProcessing}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}