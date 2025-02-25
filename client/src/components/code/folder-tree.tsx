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

  const buildFileTree = (files: CodeFile[]): FileNode[] => {
    const root: { [key: string]: FileNode } = {};

    // Create folder nodes
    files.forEach(file => {
      const path = file.path || file.name;
      const parts = path.split('/');

      // Skip if it's just a file with no folders
      if (parts.length <= 1) return;

      // Create folder nodes for each part of the path
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!root[currentPath]) {
          root[currentPath] = {
            name: part,
            path: currentPath,
            type: 'folder',
            children: []
          };
        }
      }
    });

    // Add files to their respective folders
    files.forEach(file => {
      const path = file.path || file.name;
      const parts = path.split('/');

      const fileNode: FileNode = {
        name: parts[parts.length - 1],
        path: path,
        type: 'file',
        fileId: file.id
      };

      if (parts.length > 1) {
        // File is in a folder
        const parentPath = parts.slice(0, -1).join('/');
        if (root[parentPath]) {
          root[parentPath].children = root[parentPath].children || [];
          root[parentPath].children.push(fileNode);
        }
      } else {
        // Root level file
        root[path] = fileNode;
      }
    });

    // Convert to array and sort
    return Object.values(root).sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
    });
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

  const renderNode = (node: FileNode) => {
    const isExpanded = expandedFolders.has(node.path);

    if (node.type === 'folder') {
      return (
        <div key={node.path} className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-auto hover:bg-transparent"
              onClick={() => toggleFolder(node.path)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <Folder className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{node.name}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto p-1 h-auto hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onRemoveFolder(node.path)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          {isExpanded && node.children && (
            <div className="pl-6 space-y-1">
              {node.children.map(child => renderNode(child))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={node.path} className="flex items-center gap-2 pl-6">
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
        {files.map(file => {
          const path = file.path || file.name;
          if (!path.includes('/')) {
            // Render root-level files directly
            return renderNode({
              name: file.name,
              path: path,
              type: 'file',
              fileId: file.id
            });
          }
          return null;
        })}
        {tree.map(node => renderNode(node))}
      </div>
    </div>
  );
}