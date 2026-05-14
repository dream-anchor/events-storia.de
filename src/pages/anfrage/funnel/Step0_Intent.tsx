import { Utensils, Truck, MessagesSquare, CalendarDays } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import type { Intent } from "./types";
import { FUNNEL_DE } from "./i18n/de";

const buildReservationUrl = () => {
  const params = new URLSearchParams({
    rid: "115809",
    restref: "115809",
    lang: "de-DE",
    partysize: "2",
    ot_source: "Restaurant website",
  });
  return `https://www.opentable.de/restref/client/?${params.toString()}`;
};

type Tile = {
  id: Intent | "reservation";
  title: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const T = FUNNEL_DE.step0.tiles;
const TILES: Tile[] = [
  { id: "reservation", title: T.reservation.title, desc: T.reservation.desc, Icon: CalendarDays },
  { id: "inhouse",     title: T.inhouse.title,     desc: T.inhouse.desc,     Icon: Utensils },
  { id: "delivery",    title: T.delivery.title,    desc: T.delivery.desc,    Icon: Truck },
  { id: "consult",     title: T.consult.title,     desc: T.consult.desc,     Icon: MessagesSquare },
];

export const Step0_Intent = ({ onSelect }: { onSelect: (intent: Intent) => void }) => {
  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-serif font-semibold text-center mb-2">
        {FUNNEL_DE.step0.heading}
      </h2>
      <p className="text-center text-muted-foreground mb-8">
        {FUNNEL_DE.step0.subline}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TILES.map(({ id, title, desc, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              if (id === "reservation") {
                trackEvent("funnel_step_complete", { step: 0, intent: "reservation" });
                window.location.href = buildReservationUrl();
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