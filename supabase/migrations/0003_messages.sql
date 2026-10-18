-- الرسائل الخاصة بين الأصدقاء
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0002)

create table public.messages (
  id bigint generated always as identity primary key,
  sender uuid not null references public.profiles (id) on delete cascade,
  recipient uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender <> recipient)
);

create index messages_pair_idx on public.messages (sender, recipient, created_at desc);
create index messages_unread_idx on public.messages (recipient) where read_at is null;

alter table public.messages enable row level security;

-- القراءة مباشرة (عشان التحديث الفوري)، بس رسايلي أنا. الكتابة من الدوال تحت بس.
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;

create policy "users read their own messages"
  on public.messages for select to authenticated
  using ((select auth.uid()) in (sender, recipient));

-- التحديث الفوري للرسائل الجديدة وعلامة القراءة
alter publication supabase_realtime add table public.messages;

-- بعت رسالة، بس للأصدقاء
create function public.send_message(to_user uuid, body text)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  msg public.messages;
begin
  if me is null then raise exception 'not signed in'; end if;

  if not exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester = me and addressee = to_user) or (requester = to_user and addressee = me))
  ) then
    raise exception 'not friends';
  end if;

  insert into public.messages (sender, recipient, body)
  values (me, to_user, btrim(body))
  returning * into msg;
  return msg;
end;
$$;

-- علّم رسايل شخص إنها انقرت
create function public.mark_read(from_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.messages set read_at = now()
  where sender = from_user and recipient = auth.uid() and read_at is null;
$$;

-- قائمة المحادثات: آخر رسالة وعدد غير المقروء مع كل شخص
create function public.my_chats()
returns table (
  user_id uuid,
  public_id bigint,
  name text,
  avatar text,
  last_body text,
  last_at timestamptz,
  last_mine boolean,
  last_read boolean,
  unread integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select m.*, case when m.sender = auth.uid() then m.recipient else m.sender end as other
    from public.messages m
    where auth.uid() in (m.sender, m.recipient)
  ),
  last as (
    select distinct on (other) * from mine order by other, created_at desc, id desc
  )
  select
    p.id,
    p.public_id,
    p.name,
    p.avatar,
    l.body,
    l.created_at,
    l.sender = auth.uid(),
    l.read_at is not null,
    (select count(*)::int from mine x
     where x.other = l.other and x.recipient = auth.uid() and x.read_at is null)
  from last l
  join public.profiles p on p.id = l.other
  order by l.created_at desc;
$$;

revoke execute on function public.send_message(uuid, text) from public, anon;
revoke execute on function public.mark_read(uuid) from public, anon;
revoke execute on function public.my_chats() from public, anon;

grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.mark_read(uuid) to authenticated;
grant execute on function public.my_chats() to authenticated;
