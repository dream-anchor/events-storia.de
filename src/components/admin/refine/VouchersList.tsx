import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, CheckCircle2, RotateCcw, Loader2, Ticket } from "lucide-react";

interface Voucher {
  id: string;
  code: string;
  amount_cents: number;
  currency: string;
  status: "pending" | "paid" | "redeemed" | "cancelled" | string;
  purchaser_email: string;
  purchaser_name: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  message: string | null;
  valid_until: string;
  created_at: string;
  paid_at: string | null;
  redeemed_at: string | null;
  notes: string | null;
  pdf_url: string | null;
}

const formatEuro = (cents: number) =>
  (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "—";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { dateStyle: "medium" });

const normalizeCode = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Ausstehend", className: "bg-neutral-100 text-neutral-700 border-neutral-200" },
    paid: { label: "Bezahlt · aktiv", className: "bg-neutral-900 text-white border-neutral-900" },
    redeemed: { label: "Eingelöst", className: "bg-neutral-200 text-neutral-500 border-neutral-200 line-through" },
    cancelled: { label: "Storniert", className: "bg-neutral-100 text-neutral-400 border-neutral-200" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-neutral-100 text-neutral-700" };
  return <Badge variant="outline" className={`rounded-full px-3 py-0.5 text-xs font-medium ${cfg.className}`}>{cfg.label}</Badge>;
}

function VoucherDetail({
  voucher,
  onChanged,
}: {
  voucher: Voucher;
  onChanged: (v: Voucher) => void;
}) {
  const [busy, setBusy] = useState(false);

  const markRedeemed = async () => {
    if (!confirm(`Gutschein ${voucher.code} wirklich als eingelöst markieren?`)) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("vouchers")
      .update({
        status: "redeemed",
        redeemed_at: new Date().toISOString(),
        redeemed_by_admin: user?.id ?? null,
      })
      .eq("id", voucher.id)
      .eq("status", "paid") // Schutz: nur bezahlte einlösbar
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      toast.error("Einlösen fehlgeschlagen", { description: error?.message ?? "Gutschein konnte nicht aktualisiert werden." });
      return;
    }
    toast.success("Gutschein als eingelöst markiert");
    onChanged(data as Voucher);
  };

  const undoRedeem = async () => {
    if (!confirm(`Einlösung von ${voucher.code} rückgängig machen?`)) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("vouchers")
      .update({ status: "paid", redeemed_at: null, redeemed_by_admin: null })
      .eq("id", voucher.id)
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      toast.error("Zurücksetzen fehlgeschlagen", { description: error?.message });
      return;
    }
    toast.success("Einlösung zurückgesetzt");
    onChanged(data as Voucher);
  };

  const expired = new Date(voucher.valid_until) < new Date();

  return (
    <Card className="rounded-2xl border-neutral-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Seriennummer</div>
            <div className="font-mono text-2xl font-bold tracking-wide text-neutral-900">{voucher.code}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={voucher.status} />
            {expired && voucher.status !== "redeemed" && (
              <Badge variant="outline" className="rounded-full bg-neutral-100 text-neutral-500 border-neutral-200">
                Abgelaufen
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-neutral-500">Wert</div>
            <div className="font-semibold text-neutral-900">{formatEuro(voucher.amount_cents)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Gültig bis</div>
            <div className="font-medium text-neutral-900">{formatDate(voucher.valid_until)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Gekauft am</div>
            <div className="font-medium text-neutral-900">{formatDateTime(voucher.paid_at ?? voucher.created_at)}</div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="text-xs text-neutral-500">Käufer</div>
            <div className="font-medium text-neutral-900">{voucher.purchaser_name ?? "—"}</div>
            <div className="text-xs text-neutral-500 truncate">{voucher.purchaser_email}</div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="text-xs text-neutral-500">Empfänger</div>
            <div className="font-medium text-neutral-900">{voucher.recipient_name ?? "—"}</div>
            <div className="text-xs text-neutral-500 truncate">{voucher.recipient_email ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Eingelöst am</div>
            <div className="font-medium text-neutral-900">{formatDateTime(voucher.redeemed_at)}</div>
          </div>
        </div>

        {voucher.message && (
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 text-sm text-neutral-700">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Persönliche Nachricht</div>
            {voucher.message}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          {voucher.status === "paid" && !expired && (
            <Button onClick={markRedeemed} disabled={busy} className="rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Als eingelöst markieren
            </Button>
          )}
          {voucher.status === "paid" && expired && (
            <Button onClick={markRedeemed} disabled={busy} variant="outline" className="rounded-xl border-neutral-300">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Trotz Ablauf einlösen
            </Button>
          )}
          {voucher.status === "redeemed" && (
            <Button onClick={undoRedeem} disabled={busy} variant="outline" className="rounded-xl border-neutral-300">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Einlösung rückgängig
            </Button>
          )}
          {voucher.status === "pending" && (
            <div className="text-xs text-neutral-500">Noch nicht bezahlt — Einlösung erst nach Zahlungseingang möglich.</div>
          )}
          {voucher.status === "cancelled" && (
            <div className="text-xs text-neutral-500">Storniert — nicht einlösbar.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function VouchersList() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [match, setMatch] = useState<Voucher | null>(null);
  const [recent, setRecent] = useState<Voucher[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const loadRecent = async () => {
    setLoadingRecent(true);
    const { data, error } = await supabase
      .from("vouchers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setLoadingRecent(false);
    if (error) {
      toast.error("Liste konnte nicht geladen werden", { description: error.message });
      return;
    }
    setRecent((data ?? []) as Voucher[]);
  };

  useEffect(() => { loadRecent(); }, []);

  const handleLookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = normalizeCode(query);
    if (!code) {
      toast.error("Bitte Seriennummer eingeben");
      return;
    }
    setSearching(true);
    setMatch(null);
    const { data, error } = await supabase
      .from("vouchers")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    setSearching(false);
    if (error) {
      toast.error("Suche fehlgeschlagen", { description: error.message });
      return;
    }
    if (!data) {
      toast.error("Kein Gutschein gefunden", { description: `Seriennummer ${code} ist unbekannt.` });
      return;
    }
    setMatch(data as Voucher);
  };

  const onVoucherChanged = (updated: Voucher) => {
    setMatch(updated);
    setRecent((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
  };

  const stats = useMemo(() => {
    const paid = recent.filter((v) => v.status === "paid").length;
    const redeemed = recent.filter((v) => v.status === "redeemed").length;
    const pending = recent.filter((v) => v.status === "pending").length;
    return { paid, redeemed, pending };
  }, [recent]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center">
          <Ticket className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Gutscheine</h1>
          <p className="text-sm text-neutral-500">Seriennummer prüfen und einlösen</p>
        </div>
      </div>

      <Card className="rounded-2xl border-neutral-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Seriennummer prüfen</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="z. B. STORIA-ABCD-1234"
              className="font-mono uppercase rounded-xl border-neutral-300 focus-visible:ring-neutral-900"
              autoFocus
            />
            <Button type="submit" disabled={searching} className="rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white">
              {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Prüfen
            </Button>
          </form>
          <p className="mt-2 text-xs text-neutral-500">Groß-/Kleinschreibung und Leerzeichen werden ignoriert.</p>
        </CardContent>
      </Card>

      {match && <VoucherDetail voucher={match} onChanged={onVoucherChanged} />}

      <Card className="rounded-2xl border-neutral-200 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Letzte Gutscheine</CardTitle>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>{stats.paid} aktiv</span>
            <span>·</span>
            <span>{stats.redeemed} eingelöst</span>
            <span>·</span>
            <span>{stats.pending} ausstehend</span>
          </div>
        </CardHeader>
        <CardContent>
          {loadingRecent ? (
            <div className="py-8 text-center text-sm text-neutral-500">
              <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
              Lädt…
            </div>
          ) : recent.length === 0 ? (
            <div className="py-8 text-center text-sm text-neutral-500">Noch keine Gutscheine vorhanden.</div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {recent.map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setMatch(v); setQuery(v.code); }}
                  className="w-full flex flex-wrap items-center justify-between gap-3 py-3 text-left hover:bg-neutral-50 rounded-xl px-2 -mx-2 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-semibold text-neutral-900">{v.code}</div>
                    <div className="text-xs text-neutral-500 truncate">
                      {v.purchaser_name ?? v.purchaser_email} · {formatDateTime(v.paid_at ?? v.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-neutral-900 tabular-nums">{formatEuro(v.amount_cents)}</div>
                    <StatusBadge status={v.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default VouchersList;