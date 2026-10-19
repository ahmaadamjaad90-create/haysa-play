-- مسار VIP
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0007)
--
-- ١٨ مستوى: برونزي ١–٤، فضي ١–٤، ذهبي ١–٤، ماسي ١–٤، ملكي ١–٢.
-- النقاط بتجي من: كل جوهرة بتنصرف على هدية، التحويل من الجواهر، والنقاط اليومية.
-- المستوى دائم وما بينزل.

create table public.vip_levels (
  level integer primary key check (level between 1 and 18),
  tier text not null check (tier in ('bronze', 'silver', 'gold', 'diamond', 'royal')),
  step integer not null,
  points integer not null unique,
  -- صندوق الترقية (مرة وحدة)
  reward_coins integer not null,
  perk text not null
);

insert into public.vip_levels (level, tier, step, points, reward_coins, perk) values
  (1,  'bronze',  1, 100,     200,   'إطار برونزي + شارة VIP'),
  (2,  'bronze',  2, 300,     300,   '٣٠٠ عملة هدية'),
  (3,  'bronze',  3, 600,     500,   '٥٠٠ عملة هدية'),
  (4,  'bronze',  4, 1000,    1000,  '١,٠٠٠ عملة هدية'),
  (5,  'silver',  1, 1500,    1200,  'إطار فضي + صندوق يومي أكبر'),
  (6,  'silver',  2, 2200,    1500,  '١,٥٠٠ عملة هدية'),
  (7,  'silver',  3, 3000,    2000,  '٢,٠٠٠ عملة هدية'),
  (8,  'silver',  4, 4000,    2500,  '٢,٥٠٠ عملة هدية'),
  (9,  'gold',    1, 5500,    3000,  'إطار ذهبي + هدايا VIP'),
  (10, 'gold',    2, 11000,   4000,  '٤,٠٠٠ عملة هدية'),
  (11, 'gold',    3, 22000,   5000,  '٥,٠٠٠ عملة هدية'),
  (12, 'gold',    4, 44000,   6000,  '٦,٠٠٠ عملة هدية'),
  (13, 'diamond', 1, 88000,   8000,  'إطار ماسي + صندوق يومي أكبر'),
  (14, 'diamond', 2, 175000,  10000, '١٠,٠٠٠ عملة هدية'),
  (15, 'diamond', 3, 350000,  12000, '١٢,٠٠٠ عملة هدية'),
  (16, 'diamond', 4, 700000,  15000, '١٥,٠٠٠ عملة هدية'),
  (17, 'royal',   1, 1400000, 20000, 'إطار ملكي + أكبر صندوق يومي'),
  (18, 'royal',   2, 3000000, 30000, '٣٠,٠٠٠ عملة هدية');

alter table public.vip_levels enable row level security;
revoke all on public.vip_levels from anon, authenticated;
grant select on public.vip_levels to authenticated;
create policy "everyone reads vip levels" on public.vip_levels for select to authenticated using (true);

-- مستوى VIP من النقاط (٠ = لسا ما وصل)
create function public.vip_level_of(pts integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(max(level), 0) from public.vip_levels where points <= pts;
$$;

-- النقاط اليومية: سلسلة ٧ أيام، وإذا فوّت يوم بترجع ليوم ١
create table public.vip_daily (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  streak integer not null default 0,
  last_claim date
);
alter table public.vip_daily enable row level security;
revoke all on public.vip_daily from anon, authenticated;
grant select on public.vip_daily to authenticated;
create policy "users read their daily" on public.vip_daily for select to authenticated
  using ((select auth.uid()) = user_id);

-- صناديق الترقية اللي انستلمت
create table public.vip_rewards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  level integer not null references public.vip_levels (level),
  created_at timestamptz not null default now(),
  primary key (user_id, level)
);
alter table public.vip_rewards enable row level security;
revoke all on public.vip_rewards from anon, authenticated;
grant select on public.vip_rewards to authenticated;
create policy "users read their vip rewards" on public.vip_rewards for select to authenticated
  using ((select auth.uid()) = user_id);

-- صندوق اليوم حسب الفئة
create function public.vip_daily_box(lvl integer, out coins integer, out gems integer)
language sql
immutable
set search_path = ''
as $$
  select
    case when lvl >= 17 then 1500 when lvl >= 13 then 800 when lvl >= 9 then 400
         when lvl >= 5 then 200 when lvl >= 1 then 100 else 50 end,
    case when lvl >= 17 then 150 when lvl >= 13 then 80 when lvl >= 9 then 40
         when lvl >= 5 then 20 when lvl >= 1 then 5 else 0 end;
$$;

-- استلام النقاط اليومية + الصندوق. اليوم بتوقيت الخليج.
create function public.claim_vip_daily()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Riyadh')::date;
  d public.vip_daily;
  new_streak integer;
  pts integer;
  lvl integer;
  box record;
begin
  if me is null then raise exception 'not signed in'; end if;
  perform 1 from public.profiles where id = me for update;

  select * into d from public.vip_daily where user_id = me;
  if found and d.last_claim = today then raise exception 'already claimed'; end if;

  new_streak := case when found and d.last_claim = today - 1 then d.streak % 7 + 1 else 1 end;
  pts := (array[10, 15, 20, 25, 30, 40, 50])[new_streak];

  select public.vip_level_of(vip_points) into lvl from public.profiles where id = me;
  select * into box from public.vip_daily_box(lvl);

  insert into public.vip_daily (user_id, streak, last_claim) values (me, new_streak, today)
  on conflict (user_id) do update set streak = excluded.streak, last_claim = excluded.last_claim;

  update public.profiles
  set vip_points = vip_points + pts, coins = coins + box.coins, gems = gems + box.gems
  where id = me;

  return (
    select json_build_object('streak', new_streak, 'points', pts, 'box_coins', box.coins,
      'box_gems', box.gems, 'coins', p.coins, 'gems', p.gems, 'vip_points', p.vip_points)
    from public.profiles p where p.id = me
  );
end;
$$;
revoke execute on function public.claim_vip_daily() from public, anon;
grant execute on function public.claim_vip_daily() to authenticated;

-- استلام صندوق الترقية لمستوى وصله
create function public.claim_vip_reward(lvl integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  amount integer;
begin
  if me is null then raise exception 'not signed in'; end if;
  perform 1 from public.profiles where id = me for update;
  if (select public.vip_level_of(vip_points) from public.profiles where id = me) < lvl then
    raise exception 'level not reached';
  end if;
  select reward_coins into amount from public.vip_levels where level = lvl;
  insert into public.vip_rewards (user_id, level) values (me, lvl);
  update public.profiles set coins = coins + amount where id = me;
  return (select coins from public.profiles where id = me);
exception when unique_violation then
  raise exception 'already claimed';
end;
$$;
revoke execute on function public.claim_vip_reward(integer) from public, anon;
grant execute on function public.claim_vip_reward(integer) to authenticated;

-- تحويل الجواهر لنقاط VIP: ١ جوهرة = ١ نقطة، أقل شي ١٠
create function public.convert_gems_to_vip(amount integer)
returns table (gems integer, vip_points integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if amount < 10 then raise exception 'min 10'; end if;
  update public.profiles p set gems = p.gems - amount, vip_points = p.vip_points + amount
  where p.id = auth.uid() and p.gems >= amount;
  if not found then raise exception 'insufficient balance'; end if;
  return query select p.gems, p.vip_points from public.profiles p where p.id = auth.uid();
end;
$$;
revoke execute on function public.convert_gems_to_vip(integer) from public, anon;
grant execute on function public.convert_gems_to_vip(integer) to authenticated;

-- هدايا قسم VIP بس لأصحاب الذهبي وفوق (VIP 9)
create or replace function public.send_gift(room bigint, gift text, qty integer, recipients bigint[])
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

  if g.category = 'vip'
    and (select public.vip_level_of(vip_points) from public.profiles where id = me) < 9 then
    raise exception 'vip only';
  end if;

  select * into r from public.rooms where number = room;
  if not found then raise exception 'room not found'; end if;

  select count(*) into n from public.profiles
  where public_id = any (recipients) and id <> me;
  if n = 0 or n > 16 then raise exception 'bad recipients'; end if;

  total := g.price * qty * n;

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
      (room_number, room_name, sender, sender_name, recipient, recipient_name,
       gift_key, gift_name, gift_emoji, qty, announce)
    values
      (room, r.name, me, coalesce(my_name, 'لاعب'), rec.id, rec.name,
       g.key, g.name, g.emoji, qty, g.announce);
  end loop;

  return query select p.coins, p.gems from public.profiles p where p.id = me;
end;
$$;
