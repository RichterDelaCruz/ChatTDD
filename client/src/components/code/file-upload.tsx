import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type CodeFile } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onFileSelected: (file: CodeFile) => void;
}

export function FileUpload({ onFileSelected }: FileUploadProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const content = await file.text();
      const structure = analyzeCode(content);

      const res = await apiRequest("POST", "/api/files", {
        name: file.name,
        content,
        structure
      });
      return res.json();
    },
    onSuccess: (data: CodeFile) => {
      onFileSelected(data);
      toast({
        title: "File processed successfully",
        description: `Processed ${data.name}`
      });
    },
    onError: (error) => {
      toast({
        title: "Error processing file",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsProcessing(true);
    try {
      // Filter code files
      const codeFiles = acceptedFiles.filter(file => {
        const hasCodeExtension = /\.(js|ts|jsx|tsx|py|java|cpp|cs)$/i.test(file.name);
        return hasCodeExtension;
      });

      // Process all files sequentially
      for (const file of codeFiles) {
        await uploadMutation.mutateAsync(file);
      }

      if (codeFiles.length > 0) {
        toast({
          title: "Folder processing complete",
          description: `Processed ${codeFiles.length} code files`
        });
      } else {
        toast({
          title: "No code files found",
          description: "Upload a folder containing code files (.js, .ts, .py, etc.)",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error processing files:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [uploadMutation, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/*": [".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cpp", ".cs"]
    },
    multiple: true,
    disabled: isProcessing
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8
        flex flex-col items-center justify-center
        transition-colors
        ${isDragActive ? "border-primary bg-primary/5" : "border-muted"}
        ${isProcessing ? "opacity-50 cursor-wait" : "cursor-pointer"}
      `}
    >
      <input {...getInputProps()} directory="" webkitdirectory="" />
      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-center text-muted-foreground">
        {isProcessing
          ? "Processing files..."
          : isDragActive
          ? "Drop the folder here"
          : "Drag & drop a folder containing code files, or click to select"}
      </p>
    </div>
  );
}

function analyzeCode(content: string): { functions: any[]; classes: any[] } {
  // Simple regex-based code analysis
  // In a real app, you'd want to use a proper parser
  const functions = Array.from(content.matchAll(/function\s+(\w+)/g))
    .map((match, i) => ({
      name: match[1],
      line: content.slice(0, match.index).split("\n").length
    }));

  const classes = Array.from(content.matchAll(/class\s+(\w+)/g))
    .map((match, i) => ({
      name: match[1],
      line: content.slice(0, match.index).split("\n").length
    }));

  return { functions, classes };
}