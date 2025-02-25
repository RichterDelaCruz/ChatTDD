import { FileUpload } from "@/components/code/file-upload";
import { ChatInterface } from "@/components/chat/chat-interface";
import { TestCases } from "@/components/test/test-cases";
import { useState } from "react";
import { type CodeFile } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFileId, setActiveFileId] = useState<number | null>(null);

  const handleFileProcessed = (file: CodeFile) => {
    setActiveFileId(file.id);
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-foreground">
          TDD Code Assistant
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Card className="p-6">
              <FileUpload 
                onFileSelected={handleFileProcessed}
                onProcessingStateChange={setIsProcessing}
              />
            </Card>
          </div>

          <div>
            {activeFileId && !isProcessing && (
              <Tabs defaultValue="chat" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                  <TabsTrigger value="tests">Test Cases</TabsTrigger>
                </TabsList>
                <TabsContent value="chat">
                  <Card className="p-6">
                    <ChatInterface fileId={activeFileId} />
                  </Card>
                </TabsContent>
                <TabsContent value="tests">
                  <Card className="p-6">
                    <TestCases fileId={activeFileId} />
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}