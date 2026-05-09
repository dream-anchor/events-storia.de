import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MailThreadItemKind = "email" | "form_response";

export interface MailThreadItem {
  id: string;
  kind: MailThreadItemKind;
  direction: "inbound" | "outbound";
  from_email: string;
  to_email: string;
  cc_email?: string | null;
  bcc_email?: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  attachments: Array<{ filename: string }>;
  resend_status: string | null;
  created_at: string;
}

interface OptionRow {
  id: string;
  option_label: string | null;
  package_id: string | null;
  menu_selection: Record<string, unknown> | null;
  packages?: { name: string | null } | null;
}

function renderResponseBody(opts: {
  optionLabel: string;
  packageName: string;
  notes: string | null;
  respondedAt: string;
  customerName: string | null;
  customerEmail: string;
}) {
  const noteHtml = opts.notes
    ? `<div style="margin-top:16px;padding:12px 14px;background:#f9fafb;border-left:3px solid #9ca3af;border-radius:6px;">
         <div style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Anmerkung des Kunden</div>
         <div style="font-size:14px;color:#111827;white-space:pre-wrap;">${escapeHtml(opts.notes)}</div>
       </div>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;font-size:14px;line-height:1.6;padding:8px;margin:0;">
  <p style="margin:0 0 12px 0;">${escapeHtml(opts.customerName || "Der Kunde")} hat sich über das Online-Angebot zurückgemeldet:</p>
  <div style="padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
    <div style="font-size:12px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">Gewählte Option</div>
    <div style="font-size:16px;color:#111827;font-weight:600;">${escapeHtml(opts.optionLabel)} — ${escapeHtml(opts.packageName)}</div>
  </div>
  ${noteHtml}
</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function useMailThread(inquiryId: string) {
  const [items, setItems] = useState<MailThreadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!inquiryId) return;

    // 1) Inquiry-Stammdaten (für Form-Response)
    const { data: inquiry } = await supabase
      .from("event_inquiries")
      .select("contact_name, email")
      .eq("id", inquiryId)
      .maybeSingle();

    // 2) E-Mails
    const { data: emails } = await supabase
      .from("email_messages" as never)
      .select("*")
      .eq("inquiry_id", inquiryId)
      .order("created_at", { ascending: true });

    // 3) Form-Antworten
    const { data: responses } = await supabase
      .from("offer_customer_responses" as never)
      .select("id, selected_option_id, customer_notes, responded_at, created_at")
      .eq("inquiry_id", inquiryId)
      .order("responded_at", { ascending: true });

    const responseRows = (responses || []) as Array<{
      id: string;
      selected_option_id: string;
      customer_notes: string | null;
      responded_at: string;
      created_at: string;
    }>;

    // 4) Optionen (für Label/Paketname)
    const optionIds = responseRows.map(r => r.selected_option_id).filter(Boolean);
    let optionsById = new Map<string, OptionRow>();
    if (optionIds.length > 0) {
      const { data: options } = await supabase
        .from("inquiry_offer_options")
        .select("id, option_label, package_id, menu_selection, packages(name)")
        .in("id", optionIds);
      (options as OptionRow[] | null)?.forEach(o => optionsById.set(o.id, o));
    }

    const emailItems: MailThreadItem[] = ((emails || []) as Array<Record<string, unknown>>).map((m) => ({
      id: String(m.id),
      kind: "email",
      direction: (m.direction as "inbound" | "outbound") || "outbound",
      from_email: (m.from_email as string) || "",
      to_email: (m.to_email as string) || "",
      cc_email: m.cc_email as string | null,
      bcc_email: m.bcc_email as string | null,
      subject: (m.subject as string | null) || null,
      body_text: (m.body_text as string | null) || null,
      body_html: (m.body_html as string | null) || null,
      attachments: (m.attachments as Array<{ filename: string }>) || [],
      resend_status: (m.resend_status as string | null) || null,
      created_at: (m.created_at as string) || new Date().toISOString(),
    }));

    const responseItems: MailThreadItem[] = responseRows.map((r) => {
      const opt = optionsById.get(r.selected_option_id);
      const ms = (opt?.menu_selection || {}) as Record<string, unknown>;
      const override = (ms.packageNameOverride as string | undefined)?.trim();
      const pkgName = override || opt?.packages?.name || "Individuelles Paket";
      const optionLabel = `Option ${opt?.option_label || "?"}`;
      const respondedAt = r.responded_at || r.created_at;
      const subject = `Kundenrückmeldung: ${optionLabel} gewählt`;
      const previewText = `${inquiry?.contact_name || "Kunde"} hat ${optionLabel} (${pkgName}) gewählt.${
        r.customer_notes ? ` Anmerkung: ${r.customer_notes}` : ""
      }`;
      return {
        id: `resp-${r.id}`,
        kind: "form_response",
        direction: "inbound",
        from_email: inquiry?.email || "",
        to_email: "info@events-storia.de",
        cc_email: null,
        bcc_email: null,
        subject,
        body_text: previewText,
        body_html: renderResponseBody({
          optionLabel,
          packageName: pkgName,
          notes: r.customer_notes,
          respondedAt,
          customerName: inquiry?.contact_name || null,
          customerEmail: inquiry?.email || "",
        }),
        attachments: [],
        resend_status: "delivered_inbound",
        created_at: respondedAt,
      };
    });

    const merged = [...emailItems, ...responseItems].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    setItems(merged);
    setIsLoading(false);
  }, [inquiryId]);

  useEffect(() => {
    setIsLoading(true);
    load();

    const emailChannel = supabase
      .channel(`mail_thread_emails:${inquiryId}`)
      .on(
        "postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "v2_event_emails", filter: `event_id=eq.${inquiryId}` } as never,
        () => { load(); }
      )
      .subscribe();

    const responseChannel = supabase
      .channel(`mail_thread_responses:${inquiryId}`)
      .on(
        "postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "offer_customer_responses", filter: `inquiry_id=eq.${inquiryId}` } as never,
        () => { load(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(emailChannel);
      supabase.removeChannel(responseChannel);
    };
  }, [inquiryId, load]);

  return { items, isLoading, reload: load };
}