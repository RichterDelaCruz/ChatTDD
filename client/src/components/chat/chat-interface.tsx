import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type ChatMessage } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, RotateCw, Plus, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatInterfaceProps {
  fileId: number;
}

export function ChatInterface({ fileId }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["/api/files", fileId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/files/${fileId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json() as Promise<ChatMessage[]>;
    }
  });

  const clearChat = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/files/${fileId}/messages`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files", fileId, "messages"] });
      toast({
        title: "Chat cleared",
        description: "Starting a new conversation"
      });
    },
    onError: (error) => {
      toast({
        title: "Error clearing chat",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      // First, store the user message locally
      setPendingUserMessage(content);

      // Send user message
      await apiRequest("POST", `/api/files/${fileId}/messages`, {
        role: "user",
        content
      });

      try {
        setIsGenerating(true);
        setStreamedResponse("");

        // Stream response from DeepSeek with fileId for context
        const response = await fetch("/api/deepseek/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            prompt: content,
            fileId: fileId 
          })
        });

        if (!response.ok) {
          throw new Error("Failed to generate response");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream available");

        const decoder = new TextDecoder();
        let accumulatedResponse = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  accumulatedResponse += parsed.content;
                  setStreamedResponse(accumulatedResponse);
                }
              } catch (e) {
                console.error('Error parsing stream data:', e);
              }
            }
          }
        }

        // Send assistant message with complete response
        await apiRequest("POST", `/api/files/${fileId}/messages`, {
          role: "assistant",
          content: accumulatedResponse
        });

      } catch (error: any) {
        console.error("Error in chat:", error);
        throw new Error(error.message || "Failed to get AI response");
      } finally {
        setIsGenerating(false);
        setStreamedResponse("");
        setPendingUserMessage(null);
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
      setPendingUserMessage(null);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage.mutate(input.trim());
    }
  };

  const handleSuggestAnother = () => {
    sendMessage.mutate("Suggest another test case");
  };

  const handleNewChat = () => {
    clearChat.mutate();
  };

  const allMessages = [
    ...messages,
    ...(pendingUserMessage ? [{
      id: -1,
      fileId,
      role: "user",
      content: pendingUserMessage,
      timestamp: new Date()
    }] : [])
  ];

  const formatAssistantMessage = (content: string) => {
    // Replace section headers with styled versions
    return content
      .split('\n')
      .map((line, i, arr) => {
        if (line.endsWith(':')) {
          // Add spacing before section headers (except the first one)
          const spacing = i > 0 ? 'mt-4' : '';
          return (
            <div key={i} className={`${spacing} font-semibold text-primary`}>
              {line}
            </div>
          );
        }
        return <div key={i} className="ml-4">{line}</div>;
      });
  };

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">Test Case Suggestions</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewChat}
          disabled={clearChat.isPending || isGenerating}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {allMessages.map((message, i) => (
          <div key={i} className="mb-4">
            <div className={`p-4 rounded-lg ${
              message.role === "user"
                ? "bg-primary text-primary-foreground ml-8"
                : "bg-muted text-muted-foreground mr-8"
            }`}>
              {message.role === "assistant"
                ? formatAssistantMessage(message.content)
                : message.content}
            </div>
          </div>
        ))}
        {isGenerating && streamedResponse && (
          <div className="mb-4">
            <div className="bg-muted text-muted-foreground mr-8 p-4 rounded-lg">
              {formatAssistantMessage(streamedResponse)}
            </div>
          </div>
        )}
        {isGenerating && !streamedResponse && (
          <div className="flex items-center justify-center p-4 text-muted-foreground">
            <RotateCw className="h-4 w-4 animate-spin mr-2" />
            Analyzing codebase & generating suggestion...
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t space-y-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for test case recommendations..."
            className="flex-1"
            disabled={isGenerating}
          />
          <Button
            type="submit"
            disabled={sendMessage.isPending || isGenerating}
            className="px-3"
          >
            {isGenerating ? (
              <RotateCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleSuggestAnother}
          disabled={isGenerating || sendMessage.isPending}
        >
          <Plus className="h-4 w-4 mr-2" />
          Suggest another test case
        </Button>
      </form>
    </div>
  );
}