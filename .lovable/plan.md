

## Status: Ein abgeschlossen, eine ausstehend

### ✅ Umgesetzt: PDF-Gating im Admin-Preview

**Fertig.** Der Fix wurde in `src/pages/PublicOffer.tsx` eingebaut:

- Preview-Modus nutzt jetzt **echte DB-Phase** (`inquiry.offer_phase`) statt künstlichem `effectivePhase`
- Single-Option-Bypass verschärft (`=== 1` statt `<= 1`)
- Preview-Hinweis-Card für Admins sichtbar ("Auch in der Live-Ansicht wird der Download erst freigegeben...")

**Test-Empfehlung**: Öffne eine Multi-Option-Inquiry im Admin-Preview (`?preview=1&send=final`), stelle sicher dass `offer_phase=proposal_sent` — jetzt sollte die Hinweis-Card erscheinen statt des Download-Buttons.

---

### ⏳ Ausstehend: Auto-Save-Guard Fix

**Noch nicht genehmigt.** Du hattest Screenshots mit der Fehlermeldung *"Speichern abgebrochen: das Angebot waere geloescht worden"* hochgeladen. Der Plan dafür liegt bereit:

**Änderung**: Der überprotektive Guard in `useOfferBuilder.ts` (Zeile 140–153) wird von "blockierend mit rotem Toast" auf "stiller no-op" umgestellt. Wenn alle Optionen im Zustand `'unselected'` sind, wird einfach nichts gespeichert (kein DELETE, kein INSERT, kein Toast).

**Brauchst du diesen Fix?** Wenn ja, genehmige den Plan — dann implementiere ich ihn sofort. Wenn nicht, ist alles erledigt.

