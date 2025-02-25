import { useCallback } from "react";
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
        title: "File uploaded successfully",
        description: `Uploaded ${data.name}`
      });
    },
    onError: (error) => {
      toast({
        title: "Error uploading file",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadMutation.mutate(acceptedFiles[0]);
    }
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/*": [".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cpp", ".cs"]
    },
    multiple: false
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8
        flex flex-col items-center justify-center
        cursor-pointer transition-colors
        ${isDragActive ? "border-primary bg-primary/5" : "border-muted"}
        ${uploadMutation.isPending ? "opacity-50 cursor-wait" : ""}
      `}
    >
      <input {...getInputProps()} />
      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-center text-muted-foreground">
        {isDragActive
          ? "Drop the file here"
          : "Drag & drop a code file, or click to select"}
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
