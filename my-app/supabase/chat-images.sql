-- Run after customer-chat.sql and chat-notifications.sql.
-- Image files stay in a private bucket; only conversation participants can read them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sukimart-chat-images', 'sukimart-chat-images', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

alter table public.customer_messages add column if not exists attachment_path text;
alter table public.customer_messages drop constraint if exists customer_messages_body_check;
alter table public.customer_messages drop constraint if exists customer_messages_content_check;
alter table public.customer_messages add constraint customer_messages_content_check
  check (length(btrim(body)) <= 2000 and (length(btrim(body)) > 0 or attachment_path is not null));
grant insert (attachment_path) on public.customer_messages to authenticated;

drop policy if exists "Chat participants read images" on storage.objects;
create policy "Chat participants read images" on storage.objects for select to authenticated
using (bucket_id = 'sukimart-chat-images' and (
  public.is_admin() or ((storage.foldername(name))[1] = auth.uid()::text
    and exists(select 1 from public.profiles where user_id = auth.uid() and role = 'customer'))
));

drop policy if exists "Chat participants upload images" on storage.objects;
create policy "Chat participants upload images" on storage.objects for insert to authenticated
with check (bucket_id = 'sukimart-chat-images'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (select 1 from public.profiles p where p.user_id::text = (storage.foldername(name))[1] and p.role = 'customer')
  and (public.is_admin() or ((storage.foldername(name))[1] = auth.uid()::text
    and exists(select 1 from public.profiles where user_id = auth.uid() and role = 'customer')))
);

drop policy if exists "Customers and admins send messages" on public.customer_messages;
create policy "Customers and admins send messages" on public.customer_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (select 1 from public.profiles where user_id = customer_id and role = 'customer')
  and (public.is_admin() or (customer_id = auth.uid() and exists (select 1 from public.profiles where user_id = auth.uid() and role = 'customer')))
  and (attachment_path is null or (
    (storage.foldername(attachment_path))[1] = customer_id::text
    and (storage.foldername(attachment_path))[2] = auth.uid()::text
    and exists (select 1 from storage.objects o where o.bucket_id = 'sukimart-chat-images' and o.name = attachment_path)
  ))
);
