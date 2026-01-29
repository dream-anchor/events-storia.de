import { Sparkles, Plus, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuggestedPackage, SuggestedItem } from "./types";
import { cn } from "@/lib/utils";

interface AISuggestionsCardProps {
  suggestions: SuggestedPackage[];
  suggestedItems: SuggestedItem[];
  addedPackages: string[];
  onAddPackage: (packageName: string) => void;
  onSearch: (term: string) => void;
}

const confidenceColors = {
  high: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const confidenceLabels = {
  high: 'Hohe Übereinstimmung',
  medium: 'Möglicher Match',
  low: 'Geringer Match',
};

export const AISuggestionsCard = ({
  suggestions,
  suggestedItems,
  addedPackages,
  onAddPackage,
  onSearch,
}: AISuggestionsCardProps) => {
  if (suggestions.length === 0 && suggestedItems.length === 0) {
    return null;
  }

  const highConfidence = suggestions.filter(s => s.confidence === 'high');
  const otherSuggestions = suggestions.filter(s => s.confidence !== 'high');

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          KI-Vorschläge
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* High confidence matches */}
        {highConfidence.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Hohe Übereinstimmung:</p>
            {highConfidence.map((suggestion, idx) => {
              const isAdded = addedPackages.includes(suggestion.name);
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    isAdded 
                      ? "bg-muted/50 border-primary/30"
                      : "bg-background border-border"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">🎯 {suggestion.name}</span>
                      <Badge variant="secondary" className={confidenceColors.high}>
                        {confidenceLabels.high}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Erkannt: {suggestion.matched_keywords.map(k => `"${k}"`).join(', ')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isAdded ? "secondary" : "default"}
                    onClick={() => !isAdded && onAddPackage(suggestion.name)}
                    disabled={isAdded}
                  >
                    {isAdded ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Hinzugefügt
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3 mr-1" />
                        Hinzufügen
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Medium/Low confidence matches */}
        {otherSuggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Mögliche Matches:</p>
            {otherSuggestions.map((suggestion, idx) => {
              const isAdded = addedPackages.includes(suggestion.name);
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border bg-background",
                    isAdded && "opacity-50"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">🤔 {suggestion.name}</span>
                      <Badge variant="secondary" className={confidenceColors[suggestion.confidence]}>
                        {confidenceLabels[suggestion.confidence]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Erkannt: {suggestion.matched_keywords.map(k => `"${k}"`).join(', ')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => !isAdded && onAddPackage(suggestion.name)}
                    disabled={isAdded}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Hinzufügen
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Search terms for menu items */}
        {suggestedItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Suchbegriffe (manuell suchen):</p>
            <div className="flex flex-wrap gap-2">
              {suggestedItems.map((item, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => onSearch(item.search_term)}
                  className="h-7 text-xs"
                >
                  <Search className="h-3 w-3 mr-1" />
                  {item.search_term}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
