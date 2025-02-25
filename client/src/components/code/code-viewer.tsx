import { type CodeFile } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CodeViewerProps {
  file: CodeFile;
}

export function CodeViewer({ file }: CodeViewerProps) {
  return (
    <Card>
      <ScrollArea className="h-[400px] w-full rounded-md border">
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-2">{file.name}</h2>
          <pre className="text-sm">
            <code>{file.content}</code>
          </pre>
        </div>
      </ScrollArea>
    </Card>
  );
}