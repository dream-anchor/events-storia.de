import { useEffect, useState, useRef } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Adress-Autocomplete via Nominatim (OpenStreetMap, kostenlos, kein Key).
 *
 * Hinweis: Nominatim Usage Policy verlangt max. 1 Request/Sek und einen
 * User-Agent. Da Browser User-Agent nicht setzen können, drosseln wir auf
 * 350ms Debounce + min. 4 Zeichen + Limit 5 Resultate.
 *
 * Gibt Adresse zurück sobald User Vorschlag wählt: street, postalCode, city, country.
 */

export interface NominatimResult {
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

interface NominatimRaw {
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country?: string;
  };
}

interface Props {
  value: string;
  onChange: (street: string) => void;
  onSelect: (result: NominatimResult) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const NominatimAutocomplete = ({
  value,
  onChange,
  onSelect,
  placeholder = "Straße und Hausnummer",
  disabled,
  className,
}: Props) => {
  const [suggestions, setSuggestions] = useState<NominatimRaw[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced Nominatim search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value || value.length < 4) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&addressdetails=1&limit=5&countrycodes=de,at,ch,it,fr`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'de' } });
        if (res.ok) {
          const data = (await res.json()) as NominatimRaw[];
          setSuggestions(data);
        }
      } catch (err) {
        console.warn('[Nominatim] Fehler:', err);
      } finally {
        setIsLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (s: NominatimRaw) => {
    const street = [s.address.road, s.address.house_number].filter(Boolean).join(' ');
    const city = s.address.city || s.address.town || s.address.village || s.address.municipality || '';
    onSelect({
      street,
      postalCode: s.address.postcode || '',
      city,
      country: s.address.country || 'Deutschland',
    });
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="pl-10 h-11 bg-muted/30 dark:bg-gray-800 border-border/60 rounded-lg"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors border-b border-border/40 last:border-0",
                selectedIndex === i ? "bg-accent" : "hover:bg-accent/50"
              )}
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-foreground line-clamp-2">{s.display_name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
