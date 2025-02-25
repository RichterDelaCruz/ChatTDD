import { type CodeFile } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CodeViewerProps {
  file: CodeFile;
}

export function CodeViewer({ file }: CodeViewerProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">File Structure</h2>
        <div className="space-y-2">
          {file.structure.functions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Functions:</h3>
              <ul className="list-disc list-inside">
                {file.structure.functions.map((fn) => (
                  <li key={fn.name} className="text-sm">
                    {fn.name} (line {fn.line})
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {file.structure.classes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Classes:</h3>
              <ul className="list-disc list-inside">
                {file.structure.classes.map((cls) => (
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
              <code>{file.content}</code>
            </pre>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
