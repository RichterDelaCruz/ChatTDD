import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type ChatMessage } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, RotateCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateTestCaseRecommendation } from "@/lib/deep-seek";

interface ChatInterfaceProps {
  fileId: number;
}

export function ChatInterface({ fileId }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["/api/files", fileId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/files/${fileId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json() as Promise<ChatMessage[]>;
    }
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      // First, send user message
      await apiRequest("POST", `/api/files/${fileId}/messages`, {
        role: "user",
        content
      });

      try {
        setIsGenerating(true);
        // Generate test case recommendation
        const recommendation = await generateTestCaseRecommendation(content);

        // Send assistant message
        await apiRequest("POST", `/api/files/${fileId}/messages`, {
          role: "assistant",
          content: recommendation
        });
      } catch (error: any) {
        console.error("Error in chat:", error);
        throw new Error(error.message || "Failed to get AI response");
      } finally {
        setIsGenerating(false);
      }
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/files", fileId, "messages"] });
    },
    onError: (error) => {
      toast({
        title: "Error sending message",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage.mutate(input.trim());
    }
  };

  const handleNextSuggestion = () => {
    if (input.trim()) {
      sendMessage.mutate("Generate another test case suggestion for: " + input.trim());
    }
  };

  return (
    <div className="flex flex-col h-[600px]">
      <ScrollArea className="flex-1 p-4">
        {messages.map((message, i) => (
          <div
            key={i}
            className={`mb-4 p-3 rounded-lg ${
              message.role === "user"
                ? "bg-primary text-primary-foreground ml-8"
                : "bg-muted text-muted-foreground mr-8"
            }`}
          >
            {message.content}
          </div>
        ))}
        {isGenerating && (
          <div className="flex items-center justify-center p-4 text-muted-foreground">
            <RotateCw className="h-4 w-4 animate-spin mr-2" />
            Generating suggestion...
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for test case recommendations..."
            className="flex-1"
          />
          <div className="flex flex-col gap-2">
            <Button 
              type="submit"
              disabled={sendMessage.isPending || isGenerating}
              className="px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleNextSuggestion}
                disabled={sendMessage.isPending || isGenerating}
                className="px-3"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}