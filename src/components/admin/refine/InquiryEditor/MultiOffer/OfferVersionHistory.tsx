import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { X, FileText, RotateCcw, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OfferHistoryEntry } from "./types";

interface OfferVersionHistoryProps {
  history: OfferHistoryEntry[];
  onClose: () => void;
  onResend?: (entry: OfferHistoryEntry) => void;
}

export function OfferVersionHistory({ history, onClose, onResend }: OfferVersionHistoryProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Angebots-Historie</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">v{entry.version}</Badge>
                      <span className="text-sm font-medium">
                        {format(parseISO(entry.sentAt), "dd.MM.yyyy 'um' HH:mm", { locale: de })}
                      </span>
                    </div>
                    {entry.sentBy && (
                      <p className="text-xs text-muted-foreground">
                        von {entry.sentBy}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {entry.optionsSnapshot.length} Option{entry.optionsSnapshot.length !== 1 ? 'en' : ''}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {entry.pdfUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a href={entry.pdfUrl} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          PDF
                        </a>
                      </Button>
                    )}
                    {onResend && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResend(entry)}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Erneut senden
                      </Button>
                    )}
                  </div>
                </div>

                {/* Options Summary */}
                {entry.optionsSnapshot.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex flex-wrap gap-2">
                      {entry.optionsSnapshot.map((opt, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {opt.optionLabel}: {opt.packageName || 'Kein Paket'} - {opt.totalAmount.toFixed(0)}€
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {history.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Keine Historie vorhanden
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
