-- حذف الحساب من جوّا التطبيق (Google Play و App Store بيطلبوه)
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0019)
--
-- بيحذف المستخدم من auth.users، وكل شي مربوط فيه بينحذف معه (on delete cascade):
-- الحساب، الأصدقاء، الرسائل، الغرفة، الهدايا، المشتريات، نتائج الألعاب.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
