create table public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision integer not null check (revision > 0),
  state jsonb not null check (jsonb_typeof(state) = 'object')
);
alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon, authenticated;
grant select, insert, update, delete on public.workspaces to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', false, 2000000, array['image/png','image/jpeg','image/webp']);

create policy "Users read their screenshots" on storage.objects for select to authenticated
using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload their screenshots" on storage.objects for insert to authenticated
with check (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their screenshots" on storage.objects for delete to authenticated
using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
