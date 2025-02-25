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
    mutationFn: async (files: File[]) => {
      // Log all files with their full paths for debugging
      console.log('Files to process:', files.map(f => ({
        name: f.name,
        webkitRelativePath: f.webkitRelativePath,
        type: f.type
      })));

      const results = [];

      for (const file of files) {
        // Get full path including folder structure
        const fullPath = file.webkitRelativePath || file.name;
        console.log('Processing file:', { name: file.name, path: fullPath });

        const fileContent = await file.text();
        const fileHash = await generateFileHash(fileContent);

        const res = await apiRequest("POST", "/api/files", {
          name: file.name,
          path: fullPath, // Use the full path with folder structure
          content: fileContent,
          hash: fileHash,
          structure: analyzeCode(fileContent)
        });

        const result = await res.json();
        results.push(result);

        setProcessedFiles(prev => {
          const newCount = prev + 1;
          setProgress((newCount / totalFiles) * 100);
          return newCount;
        });
      }

      return results;
    },
    onSuccess: (files) => {
      files.forEach(file => onFileSelected(file));
      toast({
        title: "Upload complete",
        description: `Successfully processed ${files.length} files`
      });
    },
    onError: (error) => {
      toast({
        title: "Error processing files",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      setIsProcessing(true);
      onProcessingStateChange(true);
      setTotalFiles(acceptedFiles.length);
      setProcessedFiles(0);
      setProgress(0);

      try {
        await uploadMutation.mutateAsync(acceptedFiles);
      } catch (error) {
        console.error("Error processing files:", error);
      } finally {
        setIsProcessing(false);
        onProcessingStateChange(false);
      }
    },
    accept: {
      "text/*": [".js", ".jsx", ".ts", ".tsx", ".py", ".rb", ".php", ".java", ".cs", ".cpp", ".c", ".html", ".css", ".scss", ".json", ".yaml", ".yml", ".md", ".sh", ".vue", ".svelte"]
    },
    multiple: true,
    noClick: false,
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
            : "Drag & drop a project folder, or click to select"}
        </p>
      </div>

      {isProcessing && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground text-center">
            Processing files...
          </p>
        </div>
      )}
    </div>
  );
}

async function generateFileHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function analyzeCode(content: string): { functions: any[]; classes: any[] } {
  const functions = [];
  const classes = [];
  return { functions, classes };
}