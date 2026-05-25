drop policy if exists "Admins can view email logs" on public.email_delivery_logs;
drop policy if exists "Admins can manage activity_logs" on public.activity_logs;

create policy "Admins and staff can view email logs"
on public.email_delivery_logs
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'staff'::public.app_role)
);

create policy "Admins and staff can view activity logs"
on public.activity_logs
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'staff'::public.app_role)
);

create policy "Admins can create activity logs"
on public.activity_logs
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins can update activity logs"
on public.activity_logs
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins can delete activity logs"
on public.activity_logs
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));