import { CheckCircle2 } from "lucide-react";

export const ThankYou = ({ firstName }: { firstName: string }) => (
  <div className="rounded-2xl border border-border bg-card p-8 md:p-12 text-center">
    <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
      <CheckCircle2 className="h-7 w-7 text-foreground" />
    </div>
    <h2 className="text-2xl md:text-3xl font-serif font-semibold mb-3">
      Vielen Dank{firstName ? `, ${firstName}` : ""}.
    </h2>
    <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
      Ihre Anfrage ist bei uns angekommen. Wir melden uns innerhalb von 4 Stunden persönlich,
      außerhalb unserer Öffnungszeiten am nächsten Morgen.
    </p>
    <p className="text-sm text-muted-foreground mt-6">
      Dringend? <a href="tel:+498951519696" className="underline text-foreground font-medium">089 51519696</a>
    </p>
  </div>
);