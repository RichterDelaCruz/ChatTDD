import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type CodeFile } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface FileUploadProps {
  onFileSelected: (file: CodeFile) => void;
  onProcessingStateChange: (isProcessing: boolean) => void;
}

export function FileUpload({ onFileSelected, onProcessingStateChange }: FileUploadProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [processedFiles, setProcessedFiles] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const content = await file.text();
      const hash = await generateFileHash(content);

      // First check if file exists and has changed
      const existingFiles = await fetch('/api/files').then(res => res.json());
      const existingFile = existingFiles.find((f: CodeFile) => f.name === file.name);

      if (existingFile && existingFile.hash === hash) {
        // File exists and hasn't changed, return existing file
        return existingFile;
      }

      const structure = analyzeCode(content, file.name);

      const res = await apiRequest("POST", "/api/files", {
        name: file.name,
        content,
        hash,
        structure,
        path: file.webkitRelativePath || file.name // Include file path information
      });
      return res.json();
    },
    onSuccess: (data: CodeFile) => {
      onFileSelected(data);
      setProcessedFiles(prev => {
        const newCount = prev + 1;
        setProgress((newCount / totalFiles) * 100);
        return newCount;
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
    const codeFiles = acceptedFiles.filter(file => {
      const hasCodeExtension = /\.(js|ts|jsx|tsx|py|java|cpp|cs)$/i.test(file.name);
      return hasCodeExtension;
    });

    if (codeFiles.length === 0) {
      toast({
        title: "No code files found",
        description: "Upload a folder containing code files (.js, .ts, .py, etc.)",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    onProcessingStateChange(true);
    setTotalFiles(codeFiles.length);
    setProcessedFiles(0);
    setProgress(0);

    try {
      // Process all files sequentially
      for (const file of codeFiles) {
        await uploadMutation.mutateAsync(file);
      }

      toast({
        title: "Processing complete",
        description: `Successfully processed ${codeFiles.length} files`
      });
    } catch (error) {
      console.error("Error processing files:", error);
    } finally {
      setIsProcessing(false);
      onProcessingStateChange(false);
    }
  }, [uploadMutation, toast, onProcessingStateChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/*": [".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cpp", ".cs"]
    },
    multiple: true,
    disabled: isProcessing
  });

  return (
    <div className="space-y-4">
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
            ? `Processing files (${processedFiles}/${totalFiles})...`
            : isDragActive
            ? "Drop the folder here"
            : "Drag & drop a project folder containing code files, or click to select"}
        </p>
      </div>

      {isProcessing && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground text-center">
            Generating code embeddings...
          </p>
        </div>
      )}
    </div>
  );
}

// Generate a SHA-256 hash of the file content
async function generateFileHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function analyzeCode(content: string, fileName: string): { functions: any[]; classes: any[] } {
  // Enhanced code analysis based on file type
  const fileType = fileName.split('.').pop()?.toLowerCase();

  // Default patterns
  let funcPattern = /function\s+(\w+)/g;
  let classPattern = /class\s+(\w+)/g;

  // Language-specific patterns
  switch (fileType) {
    case 'py':
      funcPattern = /def\s+(\w+)/g;
      break;
    case 'java':
    case 'cs':
      funcPattern = /(public|private|protected)?\s*(static)?\s*\w+\s+(\w+)\s*\([^)]*\)/g;
      break;
    case 'ts':
    case 'tsx':
      funcPattern = /(function\s+(\w+)|const\s+(\w+)\s*=\s*(\([^)]*\)\s*=>|\([^)]*\)\s*{))/g;
      break;
  }

  const functions = Array.from(content.matchAll(funcPattern))
    .map(match => ({
      name: match[1] || match[3], // Handle both function name groups
      line: content.slice(0, match.index).split('\n').length
    }));

  const classes = Array.from(content.matchAll(classPattern))
    .map(match => ({
      name: match[1],
      line: content.slice(0, match.index).split('\n').length
    }));

  return { functions, classes };
}