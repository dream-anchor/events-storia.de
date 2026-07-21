/**
 * Manueller Fallback: fragt eSignatures nach dem aktuellen Contract-Status
 * und wendet dieselbe Logik wie der Webhook an (Status setzen, signiertes
 * PDF laden + archivieren, Angebot sperren). Damit können Admins in MAESTRO
 * eine Kostenübernahme sofort aktualisieren, falls der Webhook verzögert
 * eintrifft oder verloren geht.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";
import {
  downloadEsignaturesPdf,
  queryEsignaturesContract,
} from "../_shared/esignatures-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireAuth(req);
    const { cost_acceptance_id } = await req.json();
    if (!cost_acceptance_id) throw new Error("cost_acceptance_id fehlt");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row } = await supabase
      .from("cost_acceptances")
      .select(
        "id, inquiry_id, status, signed_at, signed_pdf_storage_path, webhook_events, esignatures_contract_id",
      )
      .eq("id", cost_acceptance_id)
      .maybeSingle();
    if (!row) throw new Error("Kostenübernahme nicht gefunden");
    if (!row.esignatures_contract_id) {
      throw new Error("Kein eSignatures-Contract verknüpft");
    }

    const { contract, raw } = await queryEsignaturesContract(
      row.esignatures_contract_id,
    );

    const events = Array.isArray(row.webhook_events) ? row.webhook_events : [];
    events.push({
      at: new Date().toISOString(),
      event: "manual_status_sync",
      payload: raw,
    });

    const contractStatus = String(contract?.status ?? "").toLowerCase();
    const signersArr = Array.isArray(contract?.signers) ? contract.signers : [];
    const signerSigned = signersArr.some((s: any) =>
      String(s?.status ?? "").toLowerCase() === "signed" || !!s?.signed_at
    );
    const isSigned =
      contractStatus === "signed" ||
      contractStatus === "contract-signed" ||
      (signersArr.length > 0 &&
        signersArr.every((s: any) =>
          String(s?.status ?? "").toLowerCase() === "signed" || !!s?.signed_at
        ));

    const pdfUrl: string | null =
      contract?.contract_pdf_url ??
      contract?.finalized_document_url ??
      contract?.final_pdf_url ??
      contract?.signed_pdf_url ??
      null;

    const alreadyFinalSigned = row.status === "signed";
    let updates: Record<string, unknown> = { webhook_events: events };

    const lockOffer = async () => {
      await supabase
        .from("v2_events")
        .update({
          locked_after_signature: true,
          cost_acceptance_id,
          offer_phase: "confirmed",
        })
        .eq("id", row.inquiry_id);
    };

    if (isSigned) {
      const nowIso = new Date().toISOString();
      const signedAtPersist =
        (row.signed_at as string | null) ??
        (typeof contract?.signed_at === "string" ? contract.signed_at : nowIso);
      await lockOffer();

      if (pdfUrl && !row.signed_pdf_storage_path) {
        try {
          const pdfBuf = await downloadEsignaturesPdf(pdfUrl);
          const storagePath = `${cost_acceptance_id}/signed.pdf`;
          const { error: upErr } = await supabase.storage
            .from("cost-acceptances")
            .upload(storagePath, pdfBuf, {
              contentType: "application/pdf",
              upsert: true,
            });
          if (upErr) throw upErr;
          const hash = await crypto.subtle.digest("SHA-256", pdfBuf);
          const sha256 = Array.from(new Uint8Array(hash))
            .map((b) => b.toString(16).padStart(2, "0")).join("");
          updates = {
            ...updates,
            status: "signed",
            signed_pdf_pending: false,
            signed_pdf_storage_path: storagePath,
            signed_pdf_sha256: sha256,
            signed_at: alreadyFinalSigned ? undefined : signedAtPersist,
            pdf_download_last_error: null,
            last_webhook_error: null,
          };
          if ((updates as any).signed_at === undefined) {
            delete (updates as any).signed_at;
          }
          if (!alreadyFinalSigned) {
            await supabase.from("activity_logs").insert({
              entity_type: "event_inquiry",
              entity_id: row.inquiry_id,
              action: "cost_acceptance_signed",
              metadata: {
                cost_acceptance_id,
                contract_id: row.esignatures_contract_id,
                via: "manual_sync",
              },
            });
          }
        } catch (pdfErr) {
          const msg = String((pdfErr as Error)?.message ?? pdfErr).slice(0, 500);
          updates = {
            ...updates,
            status: "signed_pending_pdf",
            signed_pdf_pending: true,
            signed_at: signedAtPersist,
            pdf_download_last_error: msg,
          };
        }
      } else if (!pdfUrl && !row.signed_pdf_storage_path) {
        updates = {
          ...updates,
          status: "signed_pending_pdf",
          signed_pdf_pending: true,
          signed_at: signedAtPersist,
        };
      } else if (row.signed_pdf_storage_path && !alreadyFinalSigned) {
        updates = {
          ...updates,
          status: "signed",
          signed_pdf_pending: false,
          signed_at: signedAtPersist,
        };
      }
    } else if (!alreadyFinalSigned) {
      const map: Record<string, string> = {
        sent: "sent",
        "contract-sent": "sent",
        "contract-sent-to-signer": "sent",
        viewed: "viewed",
        "contract-viewed": "viewed",
        "signature-started": "signature_started",
        declined: "declined",
        withdrawn: "withdrawn",
      };
      if (map[contractStatus]) {
        updates = { ...updates, status: map[contractStatus] };
      } else if (signerSigned) {
        updates = { ...updates, status: "signer_signed" };
      }
    }

    await supabase.from("cost_acceptances").update(updates).eq(
      "id",
      cost_acceptance_id,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        applied_status: (updates as any).status ?? row.status,
        contract_status: contractStatus,
        pdf_stored: !!(updates as any).signed_pdf_storage_path ||
          !!row.signed_pdf_storage_path,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});