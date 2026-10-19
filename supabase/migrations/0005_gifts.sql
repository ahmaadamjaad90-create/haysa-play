-- الهدايا بالغرف
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0004)
-- المستلم بياخد نقاط شعبية، والمرسل بياخد XP (١ لكل ١٠ عملات) ونقاط VIP (١ لكل جوهرة)

alter table public.profiles add column if not exists popularity bigint not null default 0;

create table public.gift_catalog (
  key text primary key,
  name text not null,
  emoji text not null,
  currency text not null check (currency in ('coins', 'gems')),
  price integer not null check (price > 0),
  -- من الأسد وفوق: شريط بالرئيسية
  announce boolean not null default false,
  sort integer not null
);

insert into public.gift_catalog (key, name, emoji, currency, price, announce, sort) values
  ('rose',    'وردة',        '🌹', 'coins', 10,    false, 1),
  ('coffee',  'فنجان قهوة',  '☕', 'coins', 20,    false, 2),
  ('clap',    'تصفيق',       '👏', 'coins', 30,    false, 3),
  ('sweets',  'حلاوة',       '🍬', 'coins', 50,    false, 4),
  ('haysa',   'هيصة',        '🎉', 'coins', 100,   false, 5),
  ('ring',    'خاتم',        '💍', 'gems',  200,   false, 6),
  ('crown',   'تاج',         '👑', 'gems',  500,   false, 7),
  ('camel',   'ناقة',        '🐪', 'gems',  1000,  false, 8),
  ('falcon',  'صقر',         '🦅', 'gems',  2500,  false, 9),
  ('lion',    'أسد',         '🦁', 'gems',  5000,  true,  10),
  ('car',     'سيارة',       '🏎️', 'gems',  10000, true,  11),
  ('yacht',   'يخت',         '🛥️', 'gems',  20000, true,  12),
  ('palace',  'قصر',         '🏰', 'gems',  50000, true,  13);

alter table public.gift_catalog enable row level security;
revoke all on public.gift_catalog from anon, authenticated;
grant select on public.gift_catalog to authenticated;
create policy "everyone reads the catalog" on public.gift_catalog for select to authenticated using (true);

-- كل هدية انبعتت (وحدة لكل مستلم)
create table public.gift_events (
  id bigint generated always as identity primary key,
  room_number bigint not null,
  room_name text not null,
  sender uuid not null references public.profiles (id) on delete cascade,
  sender_name text not null,
  recipient uuid not null references public.profiles (id) on delete cascade,
  recipient_name text not null,
  gift_key text not null references public.gift_catalog (key),
  qty integer not null check (qty in (1, 5, 10)),
  announce boolean not null,
  created_at timestamptz not null default now()
);

create index gift_events_room_idx on public.gift_events (room_number, created_at desc);
create index gift_events_announce_idx on public.gift_events (created_at desc) where announce;

alter table public.gift_events enable row level security;
revoke all on public.gift_events from anon, authenticated;
grant select on public.gift_events to authenticated;
-- الهدايا علنية بالغرفة وبالشريط
create policy "gifts are public" on public.gift_events for select to authenticated using (true);

alter publication supabase_realtime add table public.gift_events;

-- إرسال هدية لشخص أو لعدة أشخاص (كل اللي على المايك)
-- النتيجة: رصيد المرسل بعد الإرسال
create function public.send_gift(room bigint, gift text, qty integer, recipients bigint[])
returns table (coins integer, gems integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  g public.gift_catalog;
  r public.rooms;
  my_name text;
  n integer;
  total integer;
  rec record;
begin
  if me is null then raise exception 'not signed in'; end if;
  if qty not in (1, 5, 10) then raise exception 'bad qty'; end if;

  select * into g from public.gift_catalog where key = gift;
  if not found then raise exception 'unknown gift'; end if;

  select * into r from public.rooms where number = room;
  if not found then raise exception 'room not found'; end if;

  -- المستلمين لازم يكونوا لاعبين حقيقيين، ومش أنا
  select count(*) into n from public.profiles
  where public_id = any (recipients) and id <> me;
  if n = 0 or n > 16 then raise exception 'bad recipients'; end if;

  total := g.price * qty * n;

  -- نقفل صف المرسل ونخصم
  select name into my_name from public.profiles where id = me for update;
  if g.currency = 'coins' then
    update public.profiles p set coins = p.coins - total, xp = p.xp + total / 10
    where p.id = me and p.coins >= total;
  else
    update public.profiles p set gems = p.gems - total, vip_points = p.vip_points + total
    where p.id = me and p.gems >= total;
  end if;
  if not found then raise exception 'insufficient balance'; end if;

  for rec in
    select id, coalesce(name, 'لاعب') as name from public.profiles
    where public_id = any (recipients) and id <> me
  loop
    update public.profiles set popularity = popularity + g.price * qty where id = rec.id;
    insert into public.gift_events
      (room_number, room_name, sender, sender_name, recipient, recipient_name, gift_key, qty, announce)
    values
      (room, r.name, me, coalesce(my_name, 'لاعب'), rec.id, rec.name, g.key, qty, g.announce);
  end loop;

  return query select p.coins, p.gems from public.profiles p where p.id = me;
end;
$$;

revoke execute on function public.send_gift(bigint, text, integer, bigint[]) from public, anon;
grant execute on function public.send_gift(bigint, text, integer, bigint[]) to authenticated;
