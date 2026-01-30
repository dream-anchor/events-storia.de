import { FileText, ExternalLink, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface DocumentViewerProps {
  url: string;
  title?: string;
  type?: 'pdf' | 'html';
  className?: string;
}

/**
 * Inline document viewer for PDFs and HTML content
 * Uses iframe for rendering
 */
export const DocumentViewer = ({ 
  url, 
  title = 'Dokument', 
  type = 'pdf',
  className 
}: DocumentViewerProps) => {
  if (!url) return null;

  // For PDFs, add parameters to hide toolbar
  const viewerUrl = type === 'pdf' 
    ? `${url}#toolbar=0&navpanes=0` 
    : url;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <FileText className="h-4 w-4" />
          {title}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                In neuem Tab
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href={url} download>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 bg-muted/30">
          <iframe 
            src={viewerUrl}
            className="w-full h-full rounded-b-lg"
            title={title}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Inline HTML preview (for emails)
 */
interface HtmlPreviewProps {
  html: string;
  className?: string;
}

export const HtmlPreview = ({ html, className }: HtmlPreviewProps) => {
  return (
    <div 
      className={cn(
        "rounded-lg border bg-white dark:bg-muted p-4 prose prose-sm max-w-none overflow-auto",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
