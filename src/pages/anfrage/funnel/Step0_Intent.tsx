import { Utensils, Truck, MessagesSquare, CalendarDays } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import type { Intent } from "./types";

const RESERVATION_URL = "https://www.opentable.de/r/ristorante-storia-munchen";

type Tile = {
  id: Intent | "reservation";
  title: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const TILES: Tile[] = [
  { id: "reservation", title: "Tisch reservieren", desc: "Regulärer Restaurantbesuch — direkt zur Reservierung.", Icon: CalendarDays },
  { id: "inhouse",     title: "Im Restaurant feiern", desc: "Geburtstag, Firmenfeier, Hochzeit bei uns vor Ort.", Icon: Utensils },
  { id: "delivery",    title: "Catering / Lieferung", desc: "Wir kommen zu Ihnen — Büro, Zuhause, Veranstaltungsort.", Icon: Truck },
  { id: "consult",     title: "Beratung gewünscht", desc: "Sie wissen noch nicht genau — wir helfen weiter.", Icon: MessagesSquare },
];

export const Step0_Intent = ({ onSelect }: { onSelect: (intent: Intent) => void }) => {
  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-serif font-semibold text-center mb-2">
        Womit dürfen wir helfen?
      </h2>
      <p className="text-center text-muted-foreground mb-8">
        Wählen Sie, was am besten passt.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TILES.map(({ id, title, desc, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              if (id === "reservation") {
                trackEvent("funnel_step_complete", { step: 0, intent: "reservation" });
                window.location.href = RESERVATION_URL;
                return;
              }
              trackEvent("funnel_step_complete", { step: 0, intent: id });
              onSelect(id);
            }}
            className="group min-h-[120px] text-left rounded-2xl border border-border bg-card p-5 md:p-6 hover:border-foreground/40 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-foreground/20"
            aria-label={title}
          >
            <div className="flex items-start gap-4">
              <span className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-foreground/70 group-hover:bg-neutral-200 transition-colors">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <div className="font-semibold text-base md:text-lg">{title}</div>
                <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};