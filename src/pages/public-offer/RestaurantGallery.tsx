import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import uebersichtGaeste from "@/assets/storia-uebersicht-gaeste.webp";
import uebersichtDetails from "@/assets/storia-uebersicht-details.webp";

type Photo = { src: string; alt: string; caption: string };

const PHOTOS: Photo[] = [
  {
    src: uebersichtGaeste,
    alt: "Ristorante Storia München – Eindrücke mit Gästen, Bar, Terrasse und Außenansicht",
    caption: "Ristorante Storia · München-Maxvorstadt",
  },
  {
    src: uebersichtDetails,
    alt: "Ristorante Storia München – Innenraum, Show-Küche, Weinwand und Außenansichten",
    caption: "Räume, Küche & Terrasse",
  },
];

export function RestaurantGallery() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isOpen = openIndex !== null;

  const close = useCallback(() => setOpenIndex(null), []);
  const next = useCallback(
    () => setOpenIndex((i) => (i === null ? i : (i + 1) % PHOTOS.length)),
    [],
  );
  const prev = useCallback(
    () => setOpenIndex((i) => (i === null ? i : (i - 1 + PHOTOS.length) % PHOTOS.length)),
    [],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, next, prev]);

  const current = openIndex !== null ? PHOTOS[openIndex] : null;

  return (
    <section
      aria-label="Eindrücke aus dem Ristorante Storia"
      className="container mx-auto px-4 pt-10 pb-6 md:pt-14 md:pb-10"
    >
      <div className="max-w-3xl mb-6 md:mb-8">
        <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Ristorante Storia · München-Maxvorstadt
        </p>
        <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-2">
          Lernen Sie unser Haus kennen
        </h2>
        <p className="text-sm md:text-base text-muted-foreground">
          Ein kurzer Eindruck von Räumen, Terrasse und Küche – tippen Sie auf ein Bild für die Großansicht.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {PHOTOS.map((photo, i) => (
          <button
            key={photo.src}
            type="button"
            onClick={() => setOpenIndex(i)}
            aria-label={`${photo.caption} – Großansicht öffnen`}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-border/40 bg-muted",
              "shadow-[var(--shadow-card,_0_1px_3px_rgba(0,0,0,0.08))]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              "aspect-[3/2]",
            )}
          >
            <img
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent p-3 md:p-4">
              <span className="text-[11px] md:text-xs font-sans font-medium tracking-wide text-white/95">
                {photo.caption}
              </span>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
        <DialogContent
          className="max-w-[96vw] md:max-w-5xl border-0 bg-black/95 p-0 text-white shadow-none [&>button]:hidden"
        >
          {current && (
            <div className="relative flex h-[88vh] flex-col">
              <div className="relative flex-1 flex items-center justify-center p-2 md:p-6">
                <img
                  src={current.src}
                  alt={current.alt}
                  className="max-h-full max-w-full object-contain rounded-lg"
                />

                <button
                  type="button"
                  onClick={prev}
                  aria-label="Vorheriges Bild"
                  className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center transition"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  aria-label="Nächstes Bild"
                  className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center transition"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>

                <button
                  type="button"
                  onClick={close}
                  aria-label="Schließen"
                  className="absolute right-2 md:right-4 top-2 md:top-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-3 border-t border-white/10">
                <span className="text-sm font-sans text-white/90">{current.caption}</span>
                <span className="text-xs font-sans tabular-nums text-white/60">
                  {(openIndex ?? 0) + 1} / {PHOTOS.length}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default RestaurantGallery;