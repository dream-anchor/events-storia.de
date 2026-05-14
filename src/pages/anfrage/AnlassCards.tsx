import { ArrowRight } from "lucide-react";

const ANLAESSE = [
  {
    title: "Firmenfeier",
    body:
      "Ob Weihnachtsfeier, Sommerfest, Teamevent oder Jubiläum — wir richten Firmenanlässe für 10 bis 80 Personen aus. Im Restaurant oder als Catering an Ihrem Ort.",
    href: "/firmenfeier-catering-muenchen",
    linkLabel: "Details zur Firmenfeier München",
  },
  {
    title: "Hochzeit",
    body:
      "Eine kleine, persönliche Hochzeitsfeier im Restaurant oder italienisches Catering für die große Feier — wir gestalten beides nach Ihren Wünschen.",
    href: "/hochzeit-catering-muenchen",
    linkLabel: "Details zur Hochzeit München",
  },
  {
    title: "Geburtstag",
    body:
      "Vom intimen Dinner mit zehn Gästen bis zur runden 50 mit 80 Personen. Auf Wunsch mit individuellem Menü oder Aperitivo auf unserer Terrasse.",
    href: "/geburtstag-catering-muenchen",
    linkLabel: "Details zum Geburtstag München",
  },
  {
    title: "Weihnachtsfeier",
    body:
      "Betriebsweihnachtsfeier oder privater Weihnachtsabend mit neapolitanischer Küche, festlicher Atmosphäre und Glühwein-Aperitivo. Termine ab September buchbar.",
    href: "/weihnachtsfeier-catering-muenchen",
    linkLabel: "Details zur Weihnachtsfeier München",
  },
  {
    title: "Catering",
    body:
      "Italienisches Catering in München und Umgebung — Fingerfood, Pizza Napoletana aus dem Steinofen, warme Aufläufe, Buffets und Desserts. Frisch zubereitet, zuverlässig geliefert.",
    href: "/italienisches-catering-muenchen",
    linkLabel: "Details zum Catering München",
  },
  {
    title: "Privatfeier",
    body:
      "Vom intimen Dinner mit Freunden bis zur Familienfeier — wir richten private Anlässe für jede Gruppengröße aus, im Restaurant oder als Catering bei Ihnen zuhause.",
    href: "/geburtstag-catering-muenchen",
    linkLabel: "Details zu privaten Feiern",
  },
] as const;

export const AnlassCards = () => (
  <section aria-labelledby="anfrage-anlaesse" className="space-y-6">
    <h2 id="anfrage-anlaesse" className="text-2xl md:text-3xl font-serif font-bold tracking-tight">
      Welche Anlässe wir ausrichten
    </h2>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ANLAESSE.map((a) => (
        <a
          key={a.title}
          href={a.href}
          className="group rounded-2xl border border-border bg-card p-6 transition hover:border-foreground/30 hover:shadow-sm flex flex-col"
        >
          <h3 className="text-lg font-semibold tracking-tight mb-2">{a.title}</h3>
          <p className="text-sm leading-relaxed text-foreground/75 flex-1">{a.body}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground/90 group-hover:gap-2.5 transition-all">
            {a.linkLabel}
            <ArrowRight className="h-4 w-4" />
          </span>
        </a>
      ))}
    </div>
  </section>
);
