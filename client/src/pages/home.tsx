import { FileUpload } from "@/components/code/file-upload";
import { CodeViewer } from "@/components/code/code-viewer";
import { ChatInterface } from "@/components/chat/chat-interface";
import { TestCases } from "@/components/test/test-cases";
import { useState } from "react";
import { type CodeFile } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-foreground">
          TDD Code Assistant
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <Card className="p-6">
              <FileUpload onFileSelected={setSelectedFile} />
            </Card>

            {selectedFile && (
              <Card className="p-6">
                <CodeViewer file={selectedFile} />
              </Card>
            )}
          </div>

          <div className="space-y-8">
            {selectedFile && (
              <Tabs defaultValue="chat" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                  <TabsTrigger value="tests">Test Cases</TabsTrigger>
                </TabsList>
                <TabsContent value="chat">
                  <Card className="p-6">
                    <ChatInterface fileId={selectedFile.id} />
                  </Card>
                </TabsContent>
                <TabsContent value="tests">
                  <Card className="p-6">
                    <TestCases fileId={selectedFile.id} />
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