

# OptionCard-Dropdown: vierten Eintrag „Restaurant-Menü laden" ergänzen

## Befund

In `OptionCard.tsx` zeigen die Tile-Auswahl (Zeile 414–462) und das Header-Dropdown (Zeile 252–265) unterschiedlich viele Optionen:

| | Restaurant-Menü | Eigenes Menü | Paket | Nur E-Mail |
|---|:-:|:-:|:-:|:-:|
| Tiles (leere Karte) | ✓ | ✓ | ✓ | ✓ |
| Dropdown (bestehende Karte) | – | ✓ (als „Menü") | ✓ | ✓ |

Grund: Der Datentyp `OfferMode` kennt nur `menu | paket | email | unselected`. „Restaurant-Menü" und „Eigenes Menü" sind beide `mode = 'menu'` — sie unterscheiden sich nur darin, dass „Restaurant-Menü" zusätzlich den Import-Dialog öffnet (`onRequestImport()`). Im Dropdown wurde dieser Shortcut schlicht vergessen.

CX-Auswirkung: Wer eine bestehende Variante umbauen möchte („mach aus diesem Eigenen Menü ein Restaurant-Menü"), muss heute den Umweg über den separaten „Restaurant-Menü laden"-Button im Body gehen — nicht offensichtlich, inkonsistent zur initialen Auswahl.

## Lösung

**Eine Datei**, präzise Änderung in `src/components/admin/refine/InquiryEditor/OfferBuilder/OptionCard.tsx`:

### 1. Dropdown ergänzen (Zeile 260–264)

Neuer erster Eintrag mit Sentinel-Wert `__import` und Icon-Hint, plus Trennlinie zur Abgrenzung der „echten" Modi:

```tsx
<SelectContent>
  <SelectItem value="__import">
    <span className="flex items-center gap-2">
      <UtensilsCrossed className="h-3 w-3" />
      Restaurant-Menü laden …
    </span>
  </SelectItem>
  <SelectSeparator />
  <SelectItem value="menu">Eigenes Menü</SelectItem>
  <SelectItem value="paket">Paket</SelectItem>
  <SelectItem value="email">Nur E-Mail</SelectItem>
</SelectContent>
```

Konsequente Umbenennung: der bestehende `menu`-Eintrag heißt jetzt **„Eigenes Menü"** (statt nur „Menü") — passt 1:1 zur Tile-Sprache.

### 2. Handler-Branch (Zeile 102–109)

`handleModeSelectChange` bekommt einen neuen Pfad für den Sentinel-Wert. Der Modus wird auf `menu` gesetzt UND `onRequestImport()` aufgerufen — exakt das gleiche Verhalten wie beim Klick auf die „Restaurant-Menü"-Tile.

```tsx
const handleModeSelectChange = (value: string) => {
  if (value === '__import') {
    if (option.offerMode !== 'menu') {
      if (hasOptionData) { setPendingMode('menu'); /* nach Bestätigung Import */ return; }
      applyModeChange('menu');
    }
    onRequestImport?.();
    return;
  }
  const mode = value as OfferMode;
  if (mode === option.offerMode) return;
  if (hasOptionData) { setPendingMode(mode); return; }
  applyModeChange(mode);
};
```

`onValueChange` bleibt: `(value) => handleModeSelectChange(value)` — kein Cast mehr, weil der Sentinel kein gültiger `OfferMode` ist.

### 3. Selektierte Anzeige im Trigger

Wenn `option.offerMode === 'menu'` kann das aktuell ausgewählte Item entweder „Restaurant-Menü" (Import wurde genutzt → `option.packageName && !option.packageId`) oder „Eigenes Menü" sein. Damit der `SelectTrigger` korrekt anzeigt, setzen wir den `value`-Prop des `Select` dynamisch:

```tsx
const dropdownValue =
  option.offerMode === 'menu' && !!option.packageName && !option.packageId
    ? '__import'
    : option.offerMode;
```

Das `__import`-Item zeigt im Trigger dann „Restaurant-Menü laden …" — der Admin sieht sofort, in welchem Sub-Modus die Karte ist. Beim erneuten Klick auf den Eintrag öffnet sich der Import-Dialog wieder (z. B. um ein anderes Restaurant-Menü zu laden).

### 4. Kein Bestätigungs-Dialog-Bug

`hasOptionData` ist `true` sobald Gänge/Pakete/Inhalte existieren. Wechsel von „Eigenes Menü" → „Restaurant-Menü" innerhalb von `mode='menu'` würde technisch keine Daten verwerfen (gleicher Mode), trotzdem führt der Import meist zur Ersetzung — wir lösen den Confirm-Dialog **nur** aus, wenn der echte Mode wechselt (`option.offerMode !== 'menu'`). Innerhalb von `menu` öffnet sich direkt der Import-Sheet; eine bewusste Doppel-Aktion (Karte wegwerfen) macht der Admin über das Trash-Icon, nicht über das Mode-Dropdown.

## Geänderte Datei

- `src/components/admin/refine/InquiryEditor/OfferBuilder/OptionCard.tsx` (~15 Zeilen Diff: SelectContent, handleModeSelectChange, dropdownValue-Helper, ggf. `SelectSeparator`-Import aus shadcn/ui)

Keine Schema-, Type- oder Backend-Änderung. `OfferMode` bleibt unangetastet.

## Verifikation

1. **Leere Karte (offerMode='unselected'):** Tiles unverändert sichtbar — 4 Optionen wie vorher.
2. **Bestehende Karte mit Eigenem Menü:** Dropdown öffnet → 4 Einträge sichtbar (Restaurant-Menü laden / Eigenes Menü / Paket / Nur E-Mail). Trigger zeigt „Eigenes Menü".
3. **Klick auf „Restaurant-Menü laden …" im Dropdown:** Modus bleibt `menu`, Import-Sheet öffnet sich, Admin wählt z. B. „Tasting Menu Auriga" → Karte zeigt importierte Gänge, Trigger schaltet auf „Restaurant-Menü laden …".
4. **Bestehende Karte mit importiertem Restaurant-Menü:** Trigger zeigt „Restaurant-Menü laden …" statt „Eigenes Menü". Klick darauf → Sheet öffnet sich erneut, neues Menü kann geladen werden.
5. **Wechsel Restaurant-Menü → Paket:** Confirm-Dialog erscheint (echter Mode-Wechsel + bestehende Daten), Admin bestätigt → Karte ist auf Paket umgestellt.
6. **Wechsel Eigenes Menü → Nur E-Mail:** Confirm-Dialog wie bisher.

