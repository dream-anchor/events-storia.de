import { useState } from "react";
import { Sparkles, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SourcePanelProps {
  rawText: string;
  onRawTextChange: (text: string) => void;
  onExtract: () => void;
  isExtracting: boolean;
}

export const SourcePanel = ({
  rawText,
  onRawTextChange,
  onExtract,
  isExtracting,
}: SourcePanelProps) => {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Quelle (Rohdaten)
        </CardTitle>
        <CardDescription>
          Kunden-E-Mail oder Notizen hier einfügen
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <Textarea
          placeholder={`Fügen Sie hier die Kunden-E-Mail oder Anfrage ein...

Beispiel:
"Sehr geehrtes STORIA-Team,

wir möchten am 15. März 2026 mit ca. 40 Personen unser Firmenjubiläum bei Ihnen feiern. Wir interessieren uns für ein Business Dinner mit Weinbegleitung.

Mit freundlichen Grüßen,
Max Mustermann
ABC GmbH
m.mustermann@abc.de
+49 89 1234567"`}
          value={rawText}
          onChange={(e) => onRawTextChange(e.target.value)}
          className="flex-1 min-h-[300px] resize-none font-mono text-sm"
        />
        
        <Button
          onClick={onExtract}
          disabled={!rawText.trim() || isExtracting}
          size="lg"
          className="w-full"
        >
          {isExtracting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analysiere...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Daten & Pakete extrahieren
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
