UPDATE public.inbox_emails
SET is_hidden = true,
    hidden_reason = 'own_outbound_filtered_out',
    hidden_at = COALESCE(hidden_at, now()),
    updated_at = now()
WHERE is_hidden = false
  AND (
    lower(from_email) = 'info@events-storia.de'
    OR lower(from_email) LIKE '%@reply.events-storia.de'
  );