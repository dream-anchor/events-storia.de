import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

interface AuditEvent {
  at?: string;
  event?: string;
  payload?: unknown;
}

export function CostAcceptanceAuditDrawer({
  open,
  onOpenChange,
  events,
  contractId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  events: AuditEvent[];
  contractId?: string | null;
}) {
  const [showRaw, setShowRaw] = useState<Record<number, boolean>>({});

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>Audit-Timeline · Kostenübernahme</DrawerTitle>
          <DrawerDescription>
            {contractId
              ? `Contract: ${contractId}`
              : "Keine Contract-ID hinterlegt."}
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto px-6 pb-8 space-y-3">
          {!events?.length && (
            <p className="text-sm text-muted-foreground">
              Noch keine Audit-Ereignisse verfügbar.
            </p>
          )}
          {events?.map((evt, idx) => {
            const isOpen = !!showRaw[idx];
            const payload = (evt.payload ?? {}) as Record<string, any>;
            const data = (payload.data ?? {}) as Record<string, any>;
            const contract = (data.contract ?? {}) as Record<string, any>;
            const signer = ((contract.signers as any[])?.[0] ?? {}) as Record<
              string,
              any
            >;
            const reason: string | null =
              signer?.reason_for_decline ??
              contract?.reason_for_decline ??
              null;
            const sigValid: boolean | null =
              signer?.signature_valid ?? null;

            return (
              <div
                key={idx}
                className="rounded-2xl border border-border/60 bg-card p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{evt.event ?? "—"}</Badge>
                    {sigValid === true && (
                      <Badge variant="outline">signature_valid</Badge>
                    )}
                    {sigValid === false && (
                      <Badge variant="destructive">invalid</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {evt.at
                      ? new Date(evt.at).toLocaleString("de-DE")
                      : "—"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {signer?.name && <div>Signer: {String(signer.name)}</div>}
                  {signer?.email && <div>E-Mail: {String(signer.email)}</div>}
                  {contract?.id && <div>Contract: {String(contract.id)}</div>}
                  {contract?.title && <div>Titel: {String(contract.title)}</div>}
                  {reason && (
                    <div className="text-destructive">Grund: {reason}</div>
                  )}
                  {(evt.event ?? "").toString().includes("error") && (
                    <div className="text-destructive">
                      {JSON.stringify(payload)}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    setShowRaw((s) => ({ ...s, [idx]: !s[idx] }))
                  }
                >
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3 mr-1" />
                  ) : (
                    <ChevronRight className="h-3 w-3 mr-1" />
                  )}
                  Raw Payload
                </Button>
                {isOpen && (
                  <pre className="text-[10px] bg-muted/40 rounded-xl p-3 overflow-x-auto max-h-64">
                    {JSON.stringify(evt.payload, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}