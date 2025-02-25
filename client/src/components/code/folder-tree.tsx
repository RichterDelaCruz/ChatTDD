import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type CodeFile } from "@shared/schema";

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  fileId?: number;
}

interface FolderTreeProps {
  files: CodeFile[];
  onRemoveFile: (fileId: number) => void;
  onRemoveFolder: (folderPath: string) => void;
}

export function FolderTree({ files, onRemoveFile, onRemoveFolder }: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Build tree structure from flat file list
  const buildFileTree = (files: CodeFile[]): FileNode[] => {
    const root: { [key: string]: FileNode } = {};

    files.forEach(file => {
      const path = file.path || file.name;
      const parts = path.split('/');
      let current = root;

      // Process each part of the path
      parts.slice(0, -1).forEach(part => {
        if (!current[part]) {
          current[part] = {
            name: part,
            path: part,
            type: 'folder',
            children: []
          };
        }
        current = (current[part].children || []).reduce((acc, child) => {
          acc[child.name] = child;
          return acc;
        }, {} as { [key: string]: FileNode });
      });

      const fileName = parts[parts.length - 1];
      if (!current[fileName]) {
        current[fileName] = {
          name: fileName,
          path: path,
          type: 'file',
          fileId: file.id
        };
      }
    });

    // Convert the tree object to array format
    const convertToArray = (node: { [key: string]: FileNode }): FileNode[] => {
      return Object.values(node).map(n => ({
        ...n,
        children: n.children ? convertToArray(
          n.children.reduce((acc, child) => {
            acc[child.name] = child;
            return acc;
          }, {} as { [key: string]: FileNode })
        ) : undefined
      }));
    };

    return convertToArray(root);
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

  const renderNode = (node: FileNode, parentPath: string = '') => {
    const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    const isExpanded = expandedFolders.has(fullPath);

    if (node.type === 'folder') {
      return (
        <div key={fullPath} className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-auto hover:bg-transparent"
              onClick={() => toggleFolder(fullPath)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <Folder className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{node.name}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto p-1 h-auto hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onRemoveFolder(fullPath)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          {isExpanded && node.children && (
            <div className="pl-6 space-y-1">
              {node.children.map(child => renderNode(child, fullPath))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={fullPath} className="flex items-center gap-2 pl-6">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{node.name}</span>
        {node.fileId && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto p-1 h-auto hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => onRemoveFile(node.fileId!)}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  const tree = buildFileTree(files);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Project Structure</h3>
      <div className="space-y-1">
        {tree.map(node => renderNode(node))}
      </div>
    </div>
  );
}