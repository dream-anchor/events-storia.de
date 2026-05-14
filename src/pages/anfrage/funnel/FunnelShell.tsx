import { useEffect, useReducer, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { funnelReducer, initialFunnelState, type FunnelState } from "./types";
import { captureUtm, readUtm, clearUtm } from "./utm";
import { ProgressBar } from "./ProgressBar";
import { Step0_Intent } from "./Step0_Intent";
import { Step1_Occasion } from "./Step1_Occasion";
import { Step2_Date } from "./Step2_Date";
import { Step3_Format } from "./Step3_Format";
import { Step4_Contact } from "./Step4_Contact";
import { ThankYou } from "./ThankYou";

/**
 * /anfrage Funnel — Phase 4
 * State-Machine via useReducer. Refresh = harter Reset.
 * Intent-Wechsel zurück in Step 0 = State-Reset.
 */
export const FunnelShell = () => {
  const [state, dispatch] = useReducer(funnelReducer, initialFunnelState);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitLockRef = useRef(false);
  const focusRef = useRef<HTMLDivElement>(null);

  // UTM einmalig erfassen
  useEffect(() => { captureUtm(); }, []);

  // Step-View tracken + Fokus auf Step-Container
  useEffect(() => {
    if (done) return;
    trackEvent("funnel_step_view", { step: state.step, intent: state.intent ?? "none" });
    focusRef.current?.focus();
  }, [state.step, done, state.intent]);

  // Drop-Tracking bei pagehide (nur wenn nicht abgeschickt)
  useEffect(() => {
    const onHide = () => {
      if (!done) trackEvent("funnel_drop", { step: state.step, intent: state.intent ?? "none" });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [done, state.step, state.intent]);

  const setPatch = (patch: Partial<FunnelState>) => dispatch({ type: "SET", patch });

  const goNext = () => {
    trackEvent("funnel_step_complete", { step: state.step, intent: state.intent ?? "none" });
    // Format-Step bei consult überspringen: Step2 → Step4 direkt
    if (state.step === 2 && state.intent === "consult") {
      dispatch({ type: "GOTO", step: 4 });
    } else {
      dispatch({ type: "NEXT" });
    }
  };

  const goBack = () => {
    if (state.step === 4 && state.intent === "consult") {
      dispatch({ type: "GOTO", step: 2 });
    } else if (state.step === 1) {
      // Zurück zu Step 0 = Reset, damit Intent-Wechsel sauber ist
      dispatch({ type: "RESET" });
    } else {
      dispatch({ type: "BACK" });
    }
  };

  const handleIntent = (intent: NonNullable<typeof state.intent>) => {
    setPatch({ intent });
    dispatch({ type: "GOTO", step: 1 });
  };

  const submit = async () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    const utm = readUtm();
    const payload = {
      intent: state.intent!,
      occasion: state.occasion!,
      occasion_other: state.occasion === "sonstiges" ? (state.occasion_other || null) : null,
      people_bucket: state.people_bucket!,
      date_mode: state.date_mode!,
      date_value: state.date_mode === "fixed" ? state.date_value : null,
      date_range_start: state.date_mode === "flexible" ? state.date_range_start : null,
      date_range_end: state.date_mode === "flexible" ? state.date_range_end : null,
      format: state.intent === "consult" ? null : state.format,
      first_name: state.first_name.trim(),
      last_name: state.last_name.trim(),
      email: state.email.trim().toLowerCase(),
      phone: state.phone.trim() || null,
      notes: state.notes.trim() || null,
      gdpr_consent: state.gdpr_consent,
      gdpr_consent_at: new Date().toISOString(),
      utm_source: utm.utm_source ?? null,
      utm_medium: utm.utm_medium ?? null,
      utm_campaign: utm.utm_campaign ?? null,
      utm_term: utm.utm_term ?? null,
      utm_content: utm.utm_content ?? null,
      source_url: utm.source_url ?? (typeof window !== "undefined" ? window.location.href : null),
    };

    try {
      const { data, error } = await supabase
        .from("leads_funnel")
        .insert(payload)
        .select("id")
        .single();

      if (error || !data) throw error || new Error("Insert fehlgeschlagen");

      // SOFORT ThankYou anzeigen — Function-Call läuft fire-and-forget
      setDone(true);
      setSubmitting(false);
      clearUtm();
      trackEvent("funnel_submit", { intent: payload.intent, lead_id: data.id });

      // Fire-and-forget — kein await
      void supabase.functions.invoke("lead-notify-funnel", { body: { lead_id: data.id } });
    } catch (e) {
      const msg = (e as Error)?.message || "Unbekannter Fehler";
      setSubmitError(msg);
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  if (done) return <ThankYou firstName={state.first_name} />;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-10 shadow-sm">
      <ProgressBar step={state.step} intent={state.intent} />
      <div ref={focusRef} tabIndex={-1} className="outline-none">
        {state.step === 0 && <Step0_Intent onSelect={handleIntent} />}
        {state.step === 1 && (
          <Step1_Occasion
            occasion={state.occasion}
            occasion_other={state.occasion_other}
            people_bucket={state.people_bucket}
            onChange={setPatch}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {state.step === 2 && (
          <Step2_Date
            date_mode={state.date_mode}
            date_value={state.date_value}
            date_range_start={state.date_range_start}
            date_range_end={state.date_range_end}
            onChange={setPatch}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {state.step === 3 && state.intent && state.intent !== "consult" && (
          <Step3_Format
            intent={state.intent}
            format={state.format}
            onChange={setPatch}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {state.step === 4 && (
          <Step4_Contact
            values={{
              first_name: state.first_name,
              last_name: state.last_name,
              email: state.email,
              phone: state.phone,
              notes: state.notes,
              gdpr_consent: state.gdpr_consent,
            }}
            onChange={setPatch}
            onSubmit={submit}
            onBack={goBack}
            submitting={submitting}
            submitError={submitError}
          />
        )}
      </div>
    </div>
  );
};