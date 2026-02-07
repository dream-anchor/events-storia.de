import { Eye, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ClientPreviewProps {
  inquiryId: string;
  version?: number;
}

export const ClientPreview = ({ inquiryId, version = 1 }: ClientPreviewProps) => {
  const handleOpenPreview = () => {
    // Open the client-facing proposal view
    window.open(`/offer/${inquiryId}`, '_blank');
  };

  return (
    <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {/* Header */}
      <CardHeader className="bg-muted/30 dark:bg-gray-800/50 px-4 py-3 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Client Preview
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] px-2 py-0.5">
          v{version}
        </Badge>
      </CardHeader>

      <CardContent className="p-4">
        {/* Preview Placeholder */}
        <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-border/60 bg-muted/20 dark:bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Eye className="h-6 w-6 text-primary" />
          </div>
          <h4 className="font-bold text-foreground mb-2">Interaktives Angebot</h4>
          <p className="text-sm text-muted-foreground mb-4">
            So sieht der Kunde das Angebot auf dem Handy oder Desktop.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenPreview}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Live-Ansicht öffnen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
