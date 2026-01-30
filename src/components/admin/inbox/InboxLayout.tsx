import { ReactNode } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useInboxRealtime } from '@/hooks/useInboxRealtime';
import { cn } from '@/lib/utils';

interface InboxLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Master-Detail layout for the collaborative inbox
 * Uses resizable panels for flexible workspace
 */
export const InboxLayout = ({ sidebar, children, className }: InboxLayoutProps) => {
  // Subscribe to real-time updates
  useInboxRealtime();

  return (
    <div className={cn("h-[calc(100vh-4rem)]", className)}>
      <ResizablePanelGroup 
        direction="horizontal" 
        className="h-full rounded-lg border border-border/50 bg-background"
      >
        {/* Sidebar Panel */}
        <ResizablePanel 
          defaultSize={32} 
          minSize={25} 
          maxSize={45}
          className="bg-muted/30"
        >
          <div className="h-full flex flex-col">
            {sidebar}
          </div>
        </ResizablePanel>

        {/* Resize Handle */}
        <ResizableHandle withHandle className="bg-border/50 hover:bg-border transition-colors" />

        {/* Detail Panel */}
        <ResizablePanel defaultSize={68} minSize={50}>
          <div className="h-full overflow-auto">
            {children}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
