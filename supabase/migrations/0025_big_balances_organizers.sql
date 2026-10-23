-- أرصدة كبيرة (10 مليار)، تحويل هدايا من الأدمن، ومنظّمين للبطولات
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0024)
--
-- 1) العملات والجواهر صاروا bigint (الـ integer آخره 2 مليار تقريباً).
--    الدوال اللي بترجّع الرصيد بنعيد تعريفها بنفس الكود بس بنوع bigint.
-- 2) صاحب التطبيق (100005) بيبلّش بـ 10 مليار عملة و10 مليار جوهرة.
-- 3) الأدمن بيحوّل عملات وجواهر من رصيده لأي لاعب.
-- 4) المنظّمين: الأدمن بيضيفهم برقم الـ ID، وبيقدروا يعملوا بطولات ويديروها (بطولاتهم بس).
--    جائزة أي بطولة بتنخصم من رصيد اللي عملها، وبترجعله إذا انلغت.

alter table public.profiles alter column coins type bigint, alter column gems type bigint;

-- الدوال اللي نوع رجوعها integer للرصيد: منعيد إنشاءها من تعريفها الحالي بعد تغيير النوع
do $$
declare
  f record;
  def text;
  could_call boolean;
begin
  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('credit_gem_package', 'tester_purchase', 'credit_ad_reward', 'convert_gems_to_vip', 'send_gift')
  loop
    def := pg_get_functiondef(f.oid);
    def := replace(def, 'RETURNS integer', 'RETURNS bigint');
    def := replace(def, 'RETURNS TABLE(coins integer, gems integer)', 'RETURNS TABLE(coins bigint, gems bigint)');
    def := replace(def, 'RETURNS TABLE(gems integer, vip_points integer)', 'RETURNS TABLE(gems bigint, vip_points integer)');
    could_call := has_function_privilege('authenticated', f.oid, 'execute');
    execute format('drop function public.%I(%s)', f.proname, f.args);
    execute def;
    execute format('revoke execute on function public.%I(%s) from public, anon', f.proname, f.args);
    if could_call then
      execute format('grant execute on function public.%I(%s) to authenticated', f.proname, f.args);
    else
      execute format('revoke execute on function public.%I(%s) from authenticated', f.proname, f.args);
    end if;
  end loop;
end $$;

update public.profiles set coins = 10000000000, gems = 10000000000 where public_id = 100005;

-- ===== تحويل من الأدمن =====

create function public.admin_transfer(pid bigint, send_coins bigint, send_gems bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profiles;
  target public.profiles;
begin
  perform public._require_admin();
  if send_coins < 0 or send_gems < 0 or send_coins + send_gems = 0 then raise exception 'bad amount'; end if;
  select * into target from public.profiles where public_id = pid;
  if not found then raise exception 'player not found'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  if me.id = target.id then raise exception 'cannot send to yourself'; end if;
  if me.coins < send_coins or me.gems < send_gems then raise exception 'not enough balance'; end if;
  update public.profiles set coins = coins - send_coins, gems = gems - send_gems where id = me.id;
  update public.profiles set coins = coins + send_coins, gems = gems + send_gems where id = target.id;
  return jsonb_build_object('name', target.name, 'my_coins', me.coins - send_coins, 'my_gems', me.gems - send_gems);
end;
$$;
revoke execute on function public.admin_transfer(bigint, bigint, bigint) from public, anon;
grant execute on function public.admin_transfer(bigint, bigint, bigint) to authenticated;

-- ===== المنظّمين =====

alter table public.profiles add column if not exists is_organizer boolean not null default false;

create function public.admin_set_organizer(pid bigint, enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.profiles;
begin
  perform public._require_admin();
  update public.profiles set is_organizer = enabled where public_id = pid returning * into p;
  if not found then raise exception 'player not found'; end if;
  return jsonb_build_object('pid', p.public_id, 'name', p.name, 'avatar', p.avatar);
end;
$$;

create function public.admin_list_organizers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('pid', public_id, 'name', name, 'avatar', avatar) order by public_id)
    from public.profiles where is_organizer), '[]');
end;
$$;
revoke execute on function public.admin_set_organizer(bigint, boolean), public.admin_list_organizers() from public, anon;
grant execute on function public.admin_set_organizer(bigint, boolean), public.admin_list_organizers() to authenticated;

-- الأدمن أو منظّم البطولة نفسها (tid = null: بس منظّم)
create function public._require_organizer(tid bigint)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if public.is_app_admin(me) then return; end if;
  if not coalesce((select is_organizer from public.profiles where id = me), false) then raise exception 'not an organizer'; end if;
  if tid is not null and not exists (select 1 from public.tournaments where id = tid and created_by = me) then
    raise exception 'not your tournament';
  end if;
end;
$$;
revoke execute on function public._require_organizer(bigint) from public, anon, authenticated;

-- كم لاعب بياخد الجائزة
create function public._tr_winners(game text)
returns integer
language sql
immutable
set search_path = ''
as $$ select case when (public._tr_game(game)).teams then 2 else 1 end $$;

-- الجائزة بتنخصم من رصيد اللي عمل البطولة
create or replace function public.admin_create_tournament(game text, title text, size integer, prize_coins integer, prize_gems integer, starts timestamptz)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid bigint;
  n integer;
  me public.profiles;
begin
  perform public._require_organizer(null);
  n := public._tr_winners(game);
  select * into me from public.profiles where id = auth.uid() for update;
  if me.coins < prize_coins::bigint * n or me.gems < prize_gems::bigint * n then raise exception 'not enough balance'; end if;
  update public.profiles set coins = coins - prize_coins::bigint * n, gems = gems - prize_gems::bigint * n where id = me.id;
  insert into public.tournaments (game, title, size, prize_coins, prize_gems, starts_at, created_by)
  values (game, title, size, prize_coins, prize_gems, starts, auth.uid())
  returning id into tid;
  return tid;
end;
$$;

-- بداية البطولة: نفس الكود بس للأدمن أو منظّمها
do $$
declare
  def text;
begin
  def := pg_get_functiondef('public.admin_start_tournament(bigint)'::regprocedure);
  def := replace(def, 'perform public._require_admin();', 'perform public._require_organizer(tid);');
  execute def;
end $$;

create or replace function public.admin_set_match_winner(mid bigint, side text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.tournament_matches;
begin
  select * into m from public.tournament_matches where id = mid;
  if not found or m.status = 'done' then raise exception 'match not open'; end if;
  perform public._require_organizer(m.tournament_id);
  if side not in ('a', 'b') or (side = 'a' and m.team_a is null) or (side = 'b' and m.team_b is null) then raise exception 'bad side'; end if;
  perform public._tr_close_game(mid);
  perform public._tr_advance(mid, case when side = 'a' then m.team_a else m.team_b end);
end;
$$;

-- الإلغاء: الجائزة بترجع للي عمل البطولة
create or replace function public.admin_cancel_tournament(tid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tournaments;
  mid bigint;
  n integer;
begin
  perform public._require_organizer(tid);
  select * into t from public.tournaments where id = tid for update;
  if not found or t.status not in ('open', 'running') then return; end if;
  update public.tournaments set status = 'cancelled' where id = tid;
  n := public._tr_winners(t.game);
  update public.profiles set coins = coins + t.prize_coins::bigint * n, gems = gems + t.prize_gems::bigint * n
  where id = t.created_by;
  for mid in select id from public.tournament_matches where tournament_id = tid and status = 'playing' loop
    perform public._tr_close_game(mid);
  end loop;
end;
$$;

-- معلومات اللاعب للأدمن (مع المنظّم)
create or replace function public.admin_player(pid bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.profiles;
begin
  perform public._require_admin();
  select * into p from public.profiles where public_id = pid;
  if not found then raise exception 'player not found'; end if;
  return jsonb_build_object('pid', p.public_id, 'name', p.name, 'avatar', p.avatar, 'coins', p.coins, 'gems', p.gems,
    'xp', p.xp, 'vip_points', p.vip_points, 'banned_until', p.banned_until, 'is_admin', p.is_admin,
    'is_organizer', p.is_organizer, 'created_at', p.created_at,
    'has_room', exists (select 1 from public.rooms where owner = p.id));
end;
$$;

revoke execute on function public._tr_winners(text) from public, anon, authenticated;
