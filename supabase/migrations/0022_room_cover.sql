-- صورة الغرفة: صاحب الغرفة بيرفع صورة من جواله
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0021)
--
-- الصور بمخزن عام اسمه room-covers، وكل صاحب غرفة بيرفع بمجلّد باسمه بس (حد أقصى 2 ميغا).

alter table public.rooms add column if not exists cover text;
grant update (cover) on public.rooms to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-covers', 'room-covers', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "room covers: owner uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'room-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "room covers: owner replaces" on storage.objects for update to authenticated
  using (bucket_id = 'room-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "room covers: owner deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'room-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
