import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Folder } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type CodeFile } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FileUploadProps {
  onFileSelected: (file: CodeFile) => void;
}

export function FileUpload({ onFileSelected }: FileUploadProps) {
  const { toast } = useToast();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

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
    // Filter out folders and non-code files
    const codeFiles = acceptedFiles.filter(file => {
      const isDirectory = file.size === 0 && file.type === "";
      const hasCodeExtension = /\.(js|ts|jsx|tsx|py|java|cpp|cs)$/i.test(file.name);
      return !isDirectory && hasCodeExtension;
    });

    setPendingFiles(prev => [...prev, ...codeFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/*": [".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cpp", ".cs"]
    },
    multiple: true,
    noClick: pendingFiles.length > 0
  });

  const handleFileClick = (file: File) => {
    uploadMutation.mutate(file);
    setPendingFiles(prev => prev.filter(f => f !== file));
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8
          flex flex-col items-center justify-center
          transition-colors
          ${isDragActive ? "border-primary bg-primary/5" : "border-muted"}
          ${uploadMutation.isPending ? "opacity-50 cursor-wait" : ""}
          ${pendingFiles.length > 0 ? "border-solid" : ""}
        `}
      >
        <input {...getInputProps()} directory="" webkitdirectory="" />
        <Upload className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-center text-muted-foreground">
          {isDragActive
            ? "Drop the files here"
            : pendingFiles.length > 0
            ? "Drop more files or select from below"
            : "Drag & drop code files or folders, or click to select"}
        </p>
      </div>

      {pendingFiles.length > 0 && (
        <div className="border rounded-lg">
          <ScrollArea className="h-[200px] w-full">
            <div className="p-4 space-y-2">
              <h3 className="font-medium mb-2">Selected Files:</h3>
              {pendingFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                  onClick={() => handleFileClick(file)}
                >
                  <Folder className="h-4 w-4" />
                  <span className="text-sm">{file.name}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
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