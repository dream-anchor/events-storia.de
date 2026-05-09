CREATE OR REPLACE FUNCTION public.append_email_status_history(
  p_email_id uuid,
  p_new_status text,
  p_folder text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.inbox_emails
  SET imap_status = p_new_status,
      imap_folder = COALESCE(p_folder, imap_folder),
      status_changed_at = now(),
      status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_object(
        'status', p_new_status,
        'folder', COALESCE(p_folder, imap_folder),
        'at', now()
      ),
      updated_at = now()
  WHERE id = p_email_id;
END;
$$;