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
      // First, analyze the entire project structure
      const projectFiles = await Promise.all(
        files.map(async (file) => {
          // Log the file path to debug
          console.log('Processing file:', {
            name: file.name,
            path: file.webkitRelativePath || file.name,
            fullPath: file.webkitRelativePath,
            type: file.type
          });

          return {
            name: file.name,
            path: file.webkitRelativePath || file.name, // This contains the full path including folders
            content: await file.text(),
            hash: await generateFileHash(await file.text())
          };
        })
      );

      // Extract unique folders from file paths
      const folders = new Set<string>();
      projectFiles.forEach(file => {
        const parts = file.path.split('/');
        parts.pop(); // Remove filename
        let currentPath = '';
        parts.forEach(part => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          if (currentPath) folders.add(currentPath);
        });
      });

      console.log('Folders found:', Array.from(folders));

      // Send the entire project structure first
      await apiRequest("POST", "/api/project/structure", {
        files: projectFiles.map(f => ({
          name: f.name,
          path: f.path
        }))
      });

      // Then process each file
      const results = [];
      for (const fileInfo of projectFiles) {
        // Check if file exists and has changed
        const existingFiles = await fetch('/api/files').then(res => res.json());
        const existingFile = existingFiles.find((f: CodeFile) => f.name === fileInfo.name);

        if (existingFile && existingFile.hash === fileInfo.hash) {
          results.push({
            ...existingFile,
            path: fileInfo.path // Ensure we preserve the path
          });
          continue;
        }

        const structure = analyzeCode(fileInfo.content, fileInfo.name);

        const res = await apiRequest("POST", "/api/files", {
          name: fileInfo.name,
          content: fileInfo.content,
          hash: fileInfo.hash,
          structure,
          path: fileInfo.path
        });

        const result = await res.json();
        results.push({
          ...result,
          path: fileInfo.path // Ensure we preserve the path
        });
      }

      // Log the final processed files
      console.log('Processed files:', results.map(f => ({ name: f.name, path: f.path })));

      return results;
    },
    onSuccess: (files) => {
      files.forEach(file => onFileSelected(file));
      setProcessedFiles(prev => {
        const newCount = prev + 1;
        setProgress((newCount / totalFiles) * 100);
        return newCount;
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const codeFiles = acceptedFiles.filter(file => {
      // Expanded list of code file extensions
      const codeExtensions = [
        // Web
        '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss', '.vue', '.svelte',
        // Backend
        '.py', '.rb', '.php', '.java', '.go', '.rs', '.cs', '.cpp', '.c',
        // Config & Data
        '.json', '.yaml', '.yml', '.toml', '.xml',
        // Shell & Scripts
        '.sh', '.bash', '.zsh', '.fish',
        // Documentation
        '.md', '.rst'
      ];

      return codeExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    });

    if (codeFiles.length === 0) {
      toast({
        title: "No code files found",
        description: "Upload a folder containing code files (JavaScript, TypeScript, Python, etc.)",
        variant: "destructive"
      });
      return;
    }

    // Log initial files received
    console.log('Initial files:', codeFiles.map(f => ({
      name: f.name,
      webkitRelativePath: f.webkitRelativePath,
      type: f.type
    })));

    setIsProcessing(true);
    onProcessingStateChange(true);
    setTotalFiles(codeFiles.length);
    setProcessedFiles(0);
    setProgress(0);

    try {
      await uploadMutation.mutateAsync(codeFiles);

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
      "text/*": [
        ".js", ".jsx", ".ts", ".tsx", ".py", ".rb", ".php",
        ".java", ".go", ".rs", ".cs", ".cpp", ".c",
        ".html", ".css", ".scss", ".json", ".yaml", ".yml",
        ".md", ".sh", ".vue", ".svelte"
      ]
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
            : "Drag & drop a project folder containing code files, or click to select"}
        </p>
      </div>

      {isProcessing && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground text-center">
            Analyzing project structure and generating code embeddings...
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