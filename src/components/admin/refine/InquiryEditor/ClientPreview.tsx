import { Eye, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ClientPreviewProps {
  inquiryId: string;
  version?: number;
}

export const ClientPreview = ({ inquiryId, version = 1 }: ClientPreviewProps) => {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-border/60 bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex items-center gap-2">
        <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Client Preview
        </span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          v{version}
        </Badge>
      </div>
      <a
        href={`/offer/${inquiryId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
      >
        Live-Ansicht öffnen
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
};
