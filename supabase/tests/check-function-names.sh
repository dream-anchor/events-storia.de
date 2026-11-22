#!/usr/bin/env bash
# Typcheck der Catering-/Webhook-Functions, aber nur auf UNDEFINIERTE Bezeichner/Importe (TS2304, TS2552, TS2305, TS2724, TS2307).
# Hintergrund: ein vergessener Import (isDoublePayment im Webhook) wirft erst zur Laufzeit einen ReferenceError und ist in
# Unit-Tests der _shared-Module nicht sichtbar. Die übrigen Typfehler (supabase-Client ist untypisiert) sind Altbestand und werden ignoriert.
# Aufruf: bash supabase/tests/check-function-names.sh   (braucht Deno; --node-modules-dir=auto lädt npm:pdf-lib für den Webhook)
set -euo pipefail
cd "$(dirname "$0")/../.."
fail=0
for f in handle-stripe-webhook create-catering-payment quote-catering-order calculate-delivery; do
  # kein pipefail-Abbruch bei deno-Exit 1 (Typfehler sind Altbestand): Ausgabe sammeln, dann auswerten
  out=$( { deno check --node-modules-dir=auto "supabase/functions/$f/index.ts" 2>&1 || true; } | sed 's/\x1b\[[0-9;]*m//g')
  hits=$(printf '%s\n' "$out" | grep -E "TS(2304|2552|2305|2724|2307)" || true)
  # "error:" ohne TS-Code (z. B. Modul-Download, Auflösung, Parser) heißt: die Prüfung selbst ist gescheitert => Fehlschlag
  broken=$(printf '%s\n' "$out" | grep -E "^error:" | grep -vE "TS[0-9]+|^error: Type checking failed" || true)
  if [ -n "$hits" ]; then echo "FEHLER in $f:"; printf '%s\n' "$hits"; fail=1
  elif [ -n "$broken" ]; then echo "FEHLER in $f (Prüfung nicht durchgelaufen):"; printf '%s\n' "$broken"; fail=1
  else echo "ok  $f"; fi
done
exit $fail
