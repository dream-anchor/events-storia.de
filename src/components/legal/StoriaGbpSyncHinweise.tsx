/**
 * Nutzungshinweise und Beschreibung der internen Google-Anwendung „storia-gbp-sync“.
 *
 * Wird auf /agb/ UNTERHALB des AGB-Dokuments gerendert und ist KEIN Teil der AGB: eigene
 * Überschrift, keine Teil-/Paragrafen-Nummerierung, eigener Anker #storia-gbp-sync (dient als
 * Link „Nutzungsbedingungen“ im Google-OAuth-Zustimmungsbildschirm). Die AGB selbst
 * (src/content/agb-2026-10.json, src/config/legal.ts) bleiben davon unberührt.
 * Datenschutz dazu: Abschnitt 28 in src/content/legal/datenschutz.json.
 */

export const STORIA_GBP_SYNC_ANCHOR = "storia-gbp-sync";

const linkClass = "text-primary underline underline-offset-2 hover:no-underline break-words";
const h3Class = "text-xl font-serif font-semibold text-foreground mt-8 mb-3";

const StoriaGbpSyncHinweise = () => (
  <section
    id={STORIA_GBP_SYNC_ANCHOR}
    lang="de"
    aria-labelledby="storia-gbp-sync-titel"
    className="scroll-mt-32 mt-20 border-t-2 border-border pt-10"
  >
    <p className="text-sm uppercase tracking-wider text-muted-foreground mb-2">
      Kein Bestandteil der Allgemeinen Geschäftsbedingungen
    </p>
    <h2
      id="storia-gbp-sync-titel"
      className="text-2xl md:text-3xl font-serif font-semibold text-foreground mb-4 break-words"
    >
      Nutzungshinweise für die interne Anwendung storia-gbp-sync
    </h2>

    <div className="prose prose-lg max-w-none text-foreground/90">
      <p className="mb-3">
        „storia-gbp-sync“ ist eine interne Anwendung der Speranza GmbH, Karlstraße 47a, 80333
        München, Betreiberin des Ristorante STORIA. Sie dient ausschließlich der Pflege unseres
        eigenen Google-Unternehmensprofils „Ristorante STORIA“ über die Schnittstellen von Google
        für Unternehmensprofile (Google Business Profile APIs). Die Anwendung ist nicht öffentlich;
        es gibt keine Registrierung und keine Nutzerkonten für Gäste oder andere Dritte.
      </p>
      <p className="mb-3">
        Diese Hinweise richten sich an die Personen, die die Anwendung bedienen. Für Gäste und
        Kunden gelten sie nicht; sie sind nicht Teil der vorstehenden Allgemeinen
        Geschäftsbedingungen.
      </p>

      <h3 className={h3Class}>1. Zugang</h3>
      <p className="mb-3">
        Die Anwendung steht ausschließlich zwei namentlich berechtigten Personen aus unserem Team
        bzw. von unserem Dienstleister zur Verfügung, die die Speranza GmbH dafür bestimmt hat.
        Eine Registrierung gibt es nicht. Der Zugang darf nicht an andere Personen weitergegeben
        werden.
      </p>

      <h3 className={h3Class}>2. Zweck und Funktionen</h3>
      <p className="mb-3">
        Die Anwendung dient ausschließlich der Pflege des Google-Unternehmensprofils „Ristorante
        STORIA“. Sie kann:
      </p>
      <ul className="list-disc pl-6 mb-3 space-y-2">
        <li>
          Bewertungen zu unserem Profil abrufen und Antworten darauf veröffentlichen oder ändern;
          die Antworten entwirft ein KI-Modell und sie werden ohne vorherige Prüfung durch einen
          Mitarbeiter veröffentlicht;
        </li>
        <li>Beiträge mit Text, Foto und Schaltfläche in unserem Profil veröffentlichen;</li>
        <li>
          die Speisekarte in unserem Profil lesen und aus unserer Speisekarten-Datenbank
          aktualisieren;
        </li>
        <li>zusammengefasste Leistungsdaten zu unserem Profil abrufen;</li>
        <li>eine Auswahl positiver Bewertungen für die Anzeige auf ristorantestoria.de übernehmen.</li>
      </ul>
      <p className="mb-3">
        Bewertungen oder Beiträge löscht die Anwendung nicht; Unternehmensangaben wie Adresse oder
        Öffnungszeiten ändert sie nicht. Andere Unternehmensprofile als unser eigenes verwaltet sie
        nicht.
      </p>

      <h3 className={h3Class}>3. Erforderliche Berechtigung</h3>
      <p className="mb-3">
        Wer die Anwendung bei Google freigibt, braucht für das Unternehmensprofil „Ristorante
        STORIA“ die Rolle Inhaber oder Verwalter. Die Anwendung fordert ausschließlich die
        Berechtigung „business.manage“ (Verwaltung von Unternehmensprofilen) an. Ohne passende
        Rolle kann sie nicht auf das Profil zugreifen.
      </p>

      <h3 className={h3Class}>4. Widerruf</h3>
      <p className="mb-3">
        Die Freigabe lässt sich jederzeit im Google-Konto unter „Sicherheit“ → „Ihre Verbindungen
        zu Drittanbieter-Apps und -Diensten“ entfernen (
        <a
          href="https://myaccount.google.com/connections"
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          myaccount.google.com/connections
        </a>
        ). Danach enden automatische Beiträge, Antworten auf Bewertungen, der Abgleich der
        Speisekarte und der tägliche Abruf der Bewertungen; die gespeicherten Tokens werden
        ungültig. Die Löschung gespeicherter Tokens kann unter{" "}
        <a href="mailto:info@ristorantestoria.de" className={linkClass}>
          info@ristorantestoria.de
        </a>{" "}
        verlangt werden.
      </p>

      <h3 className={h3Class}>5. Abhängigkeit von Google-Diensten</h3>
      <p className="mb-3">
        Die Anwendung funktioniert nur, solange Google die Schnittstellen für Unternehmensprofile
        bereitstellt und die Freigabe gültig ist. Für die Nutzung der Schnittstellen gelten die{" "}
        <a
          href="https://developers.google.com/terms"
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          Nutzungsbedingungen der Google APIs
        </a>
        . Ändert oder beschränkt Google seine Dienste, fallen sie aus oder läuft die Freigabe ab,
        können einzelne Funktionen vorübergehend oder dauerhaft ausfallen. Dasselbe gilt für die
        weiteren eingesetzten Dienste (GitHub, Anthropic, Neon).
      </p>

      <h3 className={h3Class}>6. Datenschutz</h3>
      <p className="mb-3">
        Welche Daten die Anwendung verarbeitet, wo sie gespeichert werden und welche Rechte
        bestehen, beschreibt Abschnitt 28 „Interne Anwendung storia-gbp-sync“ unserer{" "}
        <a href="/datenschutz#abschnitt-28" className={linkClass}>
          Datenschutzerklärung
        </a>
        .
      </p>

      <h3 className={h3Class}>7. Kontakt</h3>
      <p className="mb-3">
        Speranza GmbH, Karlstraße 47a, 80333 München, E-Mail{" "}
        <a href="mailto:info@ristorantestoria.de" className={linkClass}>
          info@ristorantestoria.de
        </a>
        .
      </p>

      <p className="text-sm text-muted-foreground mt-6">Stand: 28. Oktober 2026</p>
    </div>
  </section>
);

export default StoriaGbpSyncHinweise;
