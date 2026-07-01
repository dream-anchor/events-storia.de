import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/typed-client";
import { toast } from "sonner";
import type { OfferHistoryEntry, OfferOptionSnapshot } from "./useOfferHistory";

/**
 * Klont eine archivierte Angebots-Version als bearbeitbaren Entwurf.
 *
 * - liest den History-Eintrag (snapshot inkl. menu_selection, totals etc.)
 * - setzt alle aktiven Live-Options auf is_active = false
 * - inserted die Snapshot-Options als NEUE Rows in inquiry_offer_options
 *   mit frischen IDs und ohne Stripe-Payment-Link (der wird beim nächsten
 *   echten Versand neu erzeugt)
 * - schreibt das alte email_content in inquiry.email_draft
 *
 * Wichtig: der History-Eintrag selbst wird NICHT angefasst (Immutability).
 */
export function useCloneOfferVersion(inquiryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (version: number) => {
      // 1. History-Eintrag holen
      const { data: historyRow, error: histErr } = await supabase
        .from("inquiry_offer_history")
        .select("*")
        .eq("inquiry_id", inquiryId)
        .eq("version", version)
        .maybeSingle();

      if (histErr) throw histErr;
      if (!historyRow) throw new Error(`Version ${version} nicht gefunden`);

      const entry = historyRow as unknown as OfferHistoryEntry;
      const snapshotOptions = (entry.options_snapshot || []) as OfferOptionSnapshot[];
      if (snapshotOptions.length === 0) {
        throw new Error("Diese Version enthält keine Optionen zum Kopieren");
      }

      // 2. Höchste Version ermitteln (für created_in_version der neuen Drafts)
      const { data: maxVersionRow } = await supabase
        .from("inquiry_offer_history")
        .select("version")
        .eq("inquiry_id", inquiryId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextDraftVersion = ((maxVersionRow as { version: number } | null)?.version ?? 0) + 1;

      // 3. Aktive Live-Options deaktivieren (nicht löschen — falls Stripe-Links
      //    existieren, bleiben sie für Reconciliation auffindbar)
      const { error: deactErr } = await supabase
        .from("inquiry_offer_options")
        .update({ is_active: false })
        .eq("inquiry_id", inquiryId)
        .eq("is_active", true);
      if (deactErr) throw deactErr;

      // 4. Snapshot-Options als neue Drafts inserten — frische IDs,
      //    Stripe-Felder gecleart, created_in_version auf nextDraftVersion.
      const newRows = snapshotOptions.map((opt, idx) => ({
        inquiry_id: inquiryId,
        option_label: opt.option_label,
        offer_mode: opt.offer_mode,
        package_id: opt.package_id,
        guest_count: opt.guest_count,
        selected_quantity: null, // Auswahl gehört zur alten Version
        total_amount: opt.total_amount,
        menu_selection: opt.menu_selection,
        is_active: true,
        sort_order: opt.sort_order ?? idx,
        offer_version: nextDraftVersion,
        created_in_version: nextDraftVersion,
        stripe_payment_link_url: null,
        stripe_payment_link_id: null,
      }));

      const { error: insErr } = await supabase
        .from("inquiry_offer_options")
        .insert(newRows);
      if (insErr) throw insErr;

      // 5. Inquiry-Status: zurück auf 'draft' (semantisch „Entwurf nach Versand").
      //    current_offer_version BLEIBT bei der zuletzt gesendeten Version stehen
      //    (nicht die geplante Draft-Nummer) — das ist die offizielle, an den Kunden
      //    kommunizierte Versionsnummer. Beim nächsten Versand inkrementiert sie.
      // Snapshot-Restore: archivierte Adressen, Zahlungsbedingungen und
      // Kontakt-/Event-Basics zurück in die Live-Inquiry schreiben, damit
      // der geklonte Draft im Editor mit exakt diesem Stand startet.
      const entryAny = entry as unknown as {
        inquiry_snapshot?: Record<string, unknown> | null;
        address_snapshot?: Record<string, unknown> | null;
        payment_terms_snapshot?: Record<string, unknown> | null;
      };
      const restore: Record<string, unknown> = {
        offer_phase: "draft",
        email_draft: entry.email_content || "",
        last_edited_at: new Date().toISOString(),
        ...(entryAny.inquiry_snapshot ?? {}),
        ...(entryAny.address_snapshot ?? {}),
        ...(entryAny.payment_terms_snapshot ?? {}),
      };
      const { error: updErr } = await supabase
        .from("event_inquiries")
        .update(restore as never)
        .eq("id", inquiryId);
      if (updErr) throw updErr;

      return { fromVersion: version, draftVersion: nextDraftVersion };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["offer-history", inquiryId] });
      queryClient.invalidateQueries({ queryKey: ["inquiry", inquiryId] });
      queryClient.invalidateQueries({ queryKey: ["event_inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["inquiry_offer_options"] });
      toast.success(
        `v${result.fromVersion} als Entwurf geladen — bitte prüfen und versenden.`,
        { duration: 6000 },
      );
    },
    onError: (err: Error) => {
      toast.error(`Kopieren fehlgeschlagen: ${err.message}`);
    },
  });
}