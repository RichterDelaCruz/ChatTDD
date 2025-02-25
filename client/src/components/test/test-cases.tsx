import { useQuery } from "@tanstack/react-query";
import { type TestCase } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

interface TestCasesProps {
  fileId: number;
}

export function TestCases({ fileId }: TestCasesProps) {
  const { data: testCases = [], isLoading } = useQuery({
    queryKey: ["/api/files", fileId, "tests"],
    queryFn: async () => {
      const res = await fetch(`/api/files/${fileId}/tests`);
      if (!res.ok) throw new Error("Failed to fetch test cases");
      return res.json() as Promise<TestCase[]>;
    }
  });

  if (isLoading) {
    return <div>Loading test cases...</div>;
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-4">
        {testCases.map((test) => (
          <Card key={test.id} className="p-4">
            <h3 className="font-medium mb-2">{test.description}</h3>
            <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
              <code>{test.testCode}</code>
            </pre>
            <div className="text-xs text-muted-foreground mt-2">
              Created: {new Date(test.createdAt).toLocaleString()}
            </div>
          </Card>
        ))}
        
        {testCases.length === 0 && (
          <div className="text-center text-muted-foreground p-8">
            No test cases generated yet. Start a conversation to get recommendations!
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
