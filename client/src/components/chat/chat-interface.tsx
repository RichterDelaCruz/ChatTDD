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
  activeFileIds: number[];
  isProcessingFiles: boolean;
}

export function ChatInterface({ activeFileIds, isProcessingFiles }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);

  // Use a stable key for chat history that doesn't depend on file IDs
  const chatHistoryKey = "global-chat-history";

  const { data: messages = [], isLoading } = useQuery({
    queryKey: [chatHistoryKey],
    queryFn: async () => {
      const res = await fetch(`/api/chat/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json() as Promise<ChatMessage[]>;
    }
  });

  const clearChat = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/chat/messages`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [chatHistoryKey] });
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
      setPendingUserMessage(content);

      await apiRequest("POST", `/api/chat/messages`, {
        role: "user",
        content
      });

      try {
        setIsGenerating(true);
        setStreamedResponse("");

        const response = await fetch("/api/deepseek/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            prompt: content,
            fileIds: activeFileIds
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

        await apiRequest("POST", `/api/chat/messages`, {
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
      queryClient.invalidateQueries({ queryKey: [chatHistoryKey] });
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
      fileIds: activeFileIds,
      role: "user",
      content: pendingUserMessage,
      timestamp: new Date()
    }] : [])
  ];

  const formatAssistantMessage = (content: string) => {
    const sections = content.split('\n\n').map((section, i) => {
      const [title, ...lines] = section.split('\n');
      if (title.endsWith(':')) {
        return (
          <div key={i} className={`mb-4 last:mb-0 ${i > 0 ? 'mt-4' : ''}`}>
            <div className="font-semibold text-primary">{title}</div>
            <div className="mt-2 text-sm text-muted-foreground">
              {lines.join('\n')}
            </div>
          </div>
        );
      }
      return <div key={i} className="mb-2">{section}</div>;
    });

    return <div className="space-y-2">{sections}</div>;
  };

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex justify-between items-center p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">Test Case Suggestions</h2>
          {activeFileIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {activeFileIds.length} file{activeFileIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
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
        <div className="max-w-4xl mx-auto space-y-6">
          {allMessages.map((message, i) => (
            <div key={i} className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}>
              <div className={`rounded-lg shadow-sm max-w-[80%] ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              } p-4`}>
                {message.role === "assistant"
                  ? formatAssistantMessage(message.content)
                  : message.content}
              </div>
            </div>
          ))}
          {isGenerating && streamedResponse && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg shadow-sm max-w-[80%] p-4">
                {formatAssistantMessage(streamedResponse)}
              </div>
            </div>
          )}
          {isGenerating && !streamedResponse && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <RotateCw className="h-5 w-5 animate-spin mr-2" />
              {activeFileIds.length > 0 ? 
                "Analyzing code & generating test case..." :
                "Generating test case..."}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-4 space-y-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeFileIds.length > 0 ? 
              "Ask for test case recommendations..." :
              "Ask any question about testing..."}
            className="min-h-[60px] max-h-[200px]"
            disabled={isGenerating}
          />
          <Button
            type="submit"
            disabled={sendMessage.isPending || isGenerating}
            className="px-3 self-end h-[60px]"
          >
            {isGenerating ? (
              <RotateCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>

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
      </div>
    </div>
  );
}