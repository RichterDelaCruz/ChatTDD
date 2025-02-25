import { useState } from "react";
import { type CodeFile } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CodeViewerProps {
  file: CodeFile;
}

export function CodeViewer({ file }: CodeViewerProps) {
  const [selectedFile, setSelectedFile] = useState<CodeFile>(file);

  const { data: allFiles = [] } = useQuery({
    queryKey: ["/api/files"],
    queryFn: async () => {
      const res = await fetch("/api/files");
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json() as Promise<CodeFile[]>;
    }
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">Project Files</h2>
        <ScrollArea className="h-[200px] w-full border rounded-md">
          <div className="p-4 space-y-2">
            {allFiles.map((f) => (
              <div
                key={f.id}
                className={`
                  p-2 rounded cursor-pointer
                  ${f.id === selectedFile.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}
                `}
                onClick={() => setSelectedFile(f)}
              >
                {f.name}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">File Structure</h2>
        <div className="space-y-2">
          {selectedFile.structure.functions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Functions:</h3>
              <ul className="list-disc list-inside">
                {selectedFile.structure.functions.map((fn) => (
                  <li key={fn.name} className="text-sm">
                    {fn.name} (line {fn.line})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedFile.structure.classes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Classes:</h3>
              <ul className="list-disc list-inside">
                {selectedFile.structure.classes.map((cls) => (
                  <li key={cls.name} className="text-sm">
                    {cls.name} (line {cls.line})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Source Code</h2>
        <Card>
          <ScrollArea className="h-[400px] w-full rounded-md border">
            <pre className="p-4 text-sm">
              <code>{selectedFile.content}</code>
            </pre>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}