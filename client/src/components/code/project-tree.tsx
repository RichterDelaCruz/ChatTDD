import { ChevronDown, ChevronRight, Folder, FileCode, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProjectTreeProps {
  files: Array<{ id: number; name: string; path: string }>;
  onRemoveFile: (fileId: number) => void;
  onRemoveFolder?: (folderPath: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  id?: number;
  children: { [key: string]: TreeNode };
}

export function ProjectTree({ files, onRemoveFile, onRemoveFolder }: ProjectTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Build tree structure
  const buildTree = () => {
    const root: TreeNode = { name: "", path: "", type: "folder", children: {} };

    files.forEach(file => {
      const pathParts = file.path.split('/');
      let currentNode = root;

      // Process each part of the path
      pathParts.forEach((part, index) => {
        const currentPath = pathParts.slice(0, index + 1).join('/');
        
        // If it's the last part, it's a file
        if (index === pathParts.length - 1) {
          currentNode.children[part] = {
            name: part,
            path: currentPath,
            type: "file",
            id: file.id,
            children: {}
          };
        } else {
          // It's a folder
          if (!currentNode.children[part]) {
            currentNode.children[part] = {
              name: part,
              path: currentPath,
              type: "folder",
              children: {}
            };
          }
          currentNode = currentNode.children[part];
        }
      });
    });

    return root;
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderNode = (node: TreeNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const indent = `pl-${level * 4}`;

    if (node.type === "folder") {
      return (
        <div key={node.path}>
          <div 
            className={cn(
              "flex items-center gap-2 py-1 px-2 hover:bg-accent rounded cursor-pointer",
              indent
            )}
            onClick={() => toggleFolder(node.path)}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Folder className="h-4 w-4 text-blue-500" />
            <span className="flex-1">{node.name}</span>
            {onRemoveFolder && node.name && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFolder(node.path);
                }}
                className="opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {isExpanded && (
            <div>
              {Object.values(node.children)
                .sort((a, b) => {
                  // Folders first, then files
                  if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
                  return a.name.localeCompare(b.name);
                })
                .map(child => renderNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={node.path}
        className={cn(
          "flex items-center gap-2 py-1 px-2 hover:bg-accent rounded group",
          indent
        )}
      >
        <FileCode className="h-4 w-4 text-green-500" />
        <span className="flex-1">{node.name}</span>
        {node.id && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemoveFile(node.id!)}
            className="opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  };

  const tree = buildTree();

  return (
    <div className="rounded-lg border bg-card text-card-foreground">
      <div className="p-2">
        {Object.values(tree.children).map(node => renderNode(node))}
      </div>
    </div>
  );
}
