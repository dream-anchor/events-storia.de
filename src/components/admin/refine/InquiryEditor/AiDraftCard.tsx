import { Sparkles, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAiDraft, type AiDraft } from "@/hooks/useAiDraft";
import { toast } from "sonner";

export interface AiDraftPrefillResult {
  ok: boolean;
  warnings: string[];
  skippedItems: Array<{ name: string; reason: string }>;
}

interface Props {
  inquiryId: string;
  /**
   * Optionaler Callback. Wenn gesetzt, erscheint der Button
   * „In OfferBuilder übernehmen". Der Callback befüllt nur den
   * lokalen OfferBuilder-UI-State und persistiert nichts.
   */
  onPrefillFromAiDraft?: (draft: AiDraft) => AiDraftPrefillResult | Promise<AiDraftPrefillResult>;
}

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (v === false) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "" || s === "null" || s === "undefined";
  }
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function show(v: unknown, fallback = "—"): string {
  if (isBlank(v)) return fallback;
  return String(v);
}

function formatEUR(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(Number(n));
  } catch {
    return `${n} €`;
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function AiDraftCard({ inquiryId, onPrefillFromAiDraft }: Props) {
  const { data, isLoading } = useAiDraft(inquiryId);

  if (isLoading) return null;
  if (!data || !data.draft) return null;

  const { draft } = data;
  const packages = (draft.suggested_packages ?? []).filter((p) => !isBlank(p?.name));
  const items = (draft.suggested_items ?? []).filter((i) => !isBlank(i?.name));
  const customItems = (draft.custom_items ?? []).filter((c) => !isBlank(c?.label));
  const openQuestions = (draft.open_questions ?? []).filter((q) => !isBlank(q));

  const estimate = draft.estimate ?? {};
  const hasEstimate = !isBlank(estimate.low) && !isBlank(estimate.high);

  const canPrefill = packages.length > 0 || items.length > 0;

  const handlePrefill = async () => {
    if (!onPrefillFromAiDraft) return;
    try {
      const result = await onPrefillFromAiDraft(draft);
      if (!result.ok) {
        toast.error("Der KI-Entwurf enthält keine übernehmbaren Positionen.");
        return;
      }
      toast.success(
        "KI-Entwurf wurde als Vorschlag in den OfferBuilder geladen. Bitte prüfen, anpassen und bewusst speichern.",
      );
      if (result.skippedItems.length > 0) {
        toast.warning(
          "Einige Positionen konnten nicht automatisch übernommen werden. Bitte Hinweise in der KI-Option prüfen.",
        );
      }
    } catch (err) {
      console.error("[AiDraftCard] prefill failed:", err);
      toast.error("Übernahme in OfferBuilder fehlgeschlagen.");
    }
  };

  return (
    <Card className="border-neutral-200">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-neutral-500" />
            <CardTitle className="text-lg">KI-Entwurf des Kunden</CardTitle>
          </div>
          <Badge variant="outline" className="border-neutral-300 text-neutral-700">
            Unverbindlich — Prüfung erforderlich
          </Badge>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {draft.generated_at && <span>Generiert: {formatDateTime(draft.generated_at)}</span>}
          {!isBlank(draft.model) && (
            <span className="ml-2">· Modell: {String(draft.model)}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          Dieser KI-Entwurf ist kein Angebot. Preise, Mengen, Verfügbarkeit und
          Menüauswahl müssen von STORIA geprüft und freigegeben werden.
        </div>

        {!isBlank(draft.summary) && (
          <section>
            <h4 className="mb-2 text-sm font-semibold text-neutral-900">Zusammenfassung</h4>
            <p className="whitespace-pre-wrap text-sm text-neutral-700">
              {String(draft.summary)}
            </p>
          </section>
        )}

        {packages.length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-semibold text-neutral-900">
              Vorgeschlagene Pakete
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paket</TableHead>
                  <TableHead className="text-right">Personen</TableHead>
                  <TableHead className="text-right">Einzelpreis</TableHead>
                  <TableHead className="text-right">Zwischensumme</TableHead>
                  <TableHead>Begründung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((p, idx) => (
                  <TableRow key={`${p.package_id ?? idx}`}>
                    <TableCell className="font-medium">{show(p.name)}</TableCell>
                    <TableCell className="text-right">{show(p.guests)}</TableCell>
                    <TableCell className="text-right">{formatEUR(p.unit_price)}</TableCell>
                    <TableCell className="text-right">{formatEUR(p.subtotal)}</TableCell>
                    <TableCell className="text-sm text-neutral-600">
                      {show(p.rationale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        {items.length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-semibold text-neutral-900">
              Vorgeschlagene Speisen
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Menge</TableHead>
                  <TableHead>Einheit</TableHead>
                  <TableHead className="text-right">Einzelpreis</TableHead>
                  <TableHead className="text-right">Zwischensumme</TableHead>
                  <TableHead>Kategorie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i, idx) => (
                  <TableRow key={`${i.menu_item_id ?? idx}`}>
                    <TableCell className="font-medium">{show(i.name)}</TableCell>
                    <TableCell className="text-right">{show(i.qty)}</TableCell>
                    <TableCell>{show(i.unit)}</TableCell>
                    <TableCell className="text-right">{formatEUR(i.unit_price)}</TableCell>
                    <TableCell className="text-right">{formatEUR(i.subtotal)}</TableCell>
                    <TableCell className="text-sm text-neutral-600">
                      {show(i.category)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        <section>
          <h4 className="mb-2 text-sm font-semibold text-neutral-900">Preisorientierung</h4>
          {hasEstimate ? (
            <p className="text-sm text-neutral-800">
              Unverbindliche Preisorientierung: ca. {formatEUR(estimate.low)}–
              {formatEUR(estimate.high)}
            </p>
          ) : (
            <p className="text-sm text-neutral-600">
              Noch keine belastbare Preisorientierung vorhanden.
            </p>
          )}
          {!isBlank(estimate.disclaimer) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {String(estimate.disclaimer)}
            </p>
          )}
        </section>

        {openQuestions.length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-semibold text-neutral-900">Offene Fragen</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
              {openQuestions.map((q, idx) => (
                <li key={idx}>{String(q)}</li>
              ))}
            </ul>
          </section>
        )}

        {customItems.length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-semibold text-neutral-900">
              Eigene Wünsche
            </h4>
            <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
              {customItems.map((c, idx) => (
                <li key={idx}>
                  <span className="font-medium">{show(c.label)}</span>
                  {!isBlank(c.note) && (
                    <span className="text-neutral-600"> — {String(c.note)}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {onPrefillFromAiDraft && (
          <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Noch nicht gespeichert · keine automatische Mail · kein PDF · kein Public-Link
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPrefill}
              onClick={handlePrefill}
              className="rounded-2xl"
              title={
                canPrefill
                  ? "Vorschlag im OfferBuilder anlegen"
                  : "Keine übernehmbaren Positionen vorhanden."
              }
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              In OfferBuilder übernehmen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
