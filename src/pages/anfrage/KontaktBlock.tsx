import { Phone, Mail, MessageCircle, MapPin, Clock } from "lucide-react";

export const KontaktBlock = () => (
  <section aria-labelledby="anfrage-kontakt" className="space-y-6">
    <h2 id="anfrage-kontakt" className="text-2xl md:text-3xl font-serif font-bold tracking-tight">
      Kontakt direkt
    </h2>
    <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Direkt erreichbar
        </h3>
        <ul className="space-y-3 text-base">
          <li className="flex items-center gap-3">
            <Phone className="h-5 w-5 shrink-0 text-foreground/60" />
            <a href="tel:+498951519696" className="hover:underline underline-offset-4">
              +49 89 51519696
            </a>
          </li>
          <li className="flex items-center gap-3">
            <Mail className="h-5 w-5 shrink-0 text-foreground/60" />
            <a href="mailto:info@events-storia.de" className="hover:underline underline-offset-4">
              info@events-storia.de
            </a>
          </li>
          <li className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 shrink-0 text-foreground/60" />
            <a
              href="https://wa.me/491636033912"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline underline-offset-4"
            >
              WhatsApp · +49 163 603 3912
            </a>
          </li>
        </ul>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Standort & Öffnungszeiten
        </h3>
        <div className="space-y-3 text-base">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 shrink-0 text-foreground/60 mt-0.5" />
            <address className="not-italic leading-relaxed">
              Karlstraße 47a<br />
              80333 München (Maxvorstadt)
            </address>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 shrink-0 text-foreground/60 mt-0.5" />
            <div className="leading-relaxed">
              <div>Mo–Fr 9:00 – 1:00</div>
              <div>Sa–So 12:00 – 1:00</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);
