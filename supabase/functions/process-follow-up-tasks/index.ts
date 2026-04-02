import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fällige, noch nicht erinnerte Aufgaben laden (inkl. Inquiry-Daten)
  const today = new Date().toISOString().split("T")[0];
  const { data: tasks, error } = await supabase
    .from("inquiry_tasks")
    .select(`
      id, title, due_date, assigned_to, inquiry_id,
      inquiry:event_inquiries(id, contact_name, company_name)
    `)
    .eq("status", "pending")
    .eq("reminder_sent", false)
    .lte("due_date", today + "T23:59:59Z");

  if (error) {
    console.error("Failed to fetch tasks:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!tasks || tasks.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  let failed = 0;

  for (const task of tasks) {
    const inquiry = task.inquiry as { id: string; contact_name: string | null; company_name: string | null } | null;
    const recipientEmail = task.assigned_to || "info@events-storia.de";
    const customerName = inquiry?.company_name || inquiry?.contact_name || "Unbekannt";
    const dueDate = task.due_date
      ? new Date(task.due_date).toLocaleDateString("de-DE")
      : "Unbekannt";
    const editUrl = `https://events-storia.de/admin/events/${task.inquiry_id}/edit`;

    const html = `
      <h3>Erinnerung: Fällige Aufgabe</h3>
      <p><strong>${task.title}</strong></p>
      <p>Anfrage: ${customerName}</p>
      <p>Fällig am: ${dueDate}</p>
      <p><a href="${editUrl}">Im Maestro öffnen</a></p>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "STORIA System <info@events-storia.de>",
          to: [recipientEmail],
          subject: `Erinnerung: ${task.title} — ${customerName}`,
          html,
        }),
      });

      if (res.ok) {
        await supabase
          .from("inquiry_tasks")
          .update({ reminder_sent: true })
          .eq("id", task.id);
        processed++;
      } else {
        console.error("Email send failed for task", task.id, await res.text());
        failed++;
      }
    } catch (err) {
      console.error("Error processing task", task.id, err);
      failed++;
    }
  }

  return new Response(JSON.stringify({ processed, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
