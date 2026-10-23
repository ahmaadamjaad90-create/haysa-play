-- أدمن التطبيق، والحظر، وبطولات البلوت
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0022)
--
-- الأدمن: مشرف بكل الغرف، بيحظر لاعبين، بيحذف غرف، بيعطي عملات وجواهر، وبيعمل بطولات.
-- البطولة: فرق من لاعبين اتنين، خروج المغلوب (4 أو 8 أو 16 فريق). كل مباراة طاولة بلوت عادية،
-- ولما تخلص الطاولة الرابح بيطلع للجولة الجاية لحاله. الفريق الفائز بالنهائي بياخد الجائزة.

-- ===== الأدمن والحظر =====

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists banned_until timestamptz;

-- صاحب التطبيق (ID 100005)
update public.profiles set is_admin = true where public_id = 100005;

create function public.is_app_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((select is_admin from public.profiles where id = uid), false) $$;
revoke execute on function public.is_app_admin(uuid) from public, anon;
grant execute on function public.is_app_admin(uuid) to authenticated, service_role;

-- الأدمن مشرف بكل الغرف
create or replace function public.is_room_mod(num bigint, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_app_admin(uid) or exists (
    select 1 from public.rooms r
    where r.number = num
      and (r.owner = uid or exists (select 1 from public.room_admins a where a.room_owner = r.owner and a.user_id = uid))
  )
$$;

create function public._require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin(auth.uid()) then raise exception 'not an admin'; end if;
end;
$$;
revoke execute on function public._require_admin() from public, anon, authenticated;

-- days = null: حظر دايم
create function public.admin_ban(pid bigint, days integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_admin();
  update public.profiles
  set banned_until = case when days is null then 'infinity'::timestamptz else now() + make_interval(days => days) end
  where public_id = pid and not is_admin;
  if not found then raise exception 'player not found'; end if;
end;
$$;

create function public.admin_unban(pid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_admin();
  update public.profiles set banned_until = null where public_id = pid;
  if not found then raise exception 'player not found'; end if;
end;
$$;

create function public.admin_grant(pid bigint, add_coins integer, add_gems integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.profiles;
begin
  perform public._require_admin();
  if add_coins < 0 or add_gems < 0 or add_coins > 1000000 or add_gems > 1000000 then raise exception 'bad amount'; end if;
  update public.profiles set coins = coins + add_coins, gems = gems + add_gems
  where public_id = pid returning * into p;
  if not found then raise exception 'player not found'; end if;
  return jsonb_build_object('name', p.name, 'coins', p.coins, 'gems', p.gems);
end;
$$;

create function public.admin_delete_room(num bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_admin();
  delete from public.rooms where number = num;
  if not found then raise exception 'room not found'; end if;
end;
$$;

create function public.admin_player(pid bigint)
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
    'created_at', p.created_at, 'has_room', exists (select 1 from public.rooms where owner = p.id));
end;
$$;

create function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'players', (select count(*) from public.profiles where name is not null),
    'new_today', (select count(*) from public.profiles where created_at > now() - interval '1 day'),
    'rooms', (select count(*) from public.rooms),
    'banned', (select count(*) from public.profiles where banned_until > now()),
    'baloot_today', (select count(*) from public.baloot_games where created_at > now() - interval '1 day'),
    'gifts_today', (select count(*) from public.gift_events where created_at > now() - interval '1 day')
  );
end;
$$;

revoke execute on function public.admin_ban(bigint, integer), public.admin_unban(bigint),
  public.admin_grant(bigint, integer, integer), public.admin_delete_room(bigint),
  public.admin_player(bigint), public.admin_stats() from public, anon;
grant execute on function public.admin_ban(bigint, integer), public.admin_unban(bigint),
  public.admin_grant(bigint, integer, integer), public.admin_delete_room(bigint),
  public.admin_player(bigint), public.admin_stats() to authenticated;

-- ===== البطولات =====

create table public.tournaments (
  id bigint generated always as identity (start with 101) primary key,
  title text not null check (char_length(title) between 2 and 40),
  game text not null default 'baloot' check (game in ('baloot')),
  -- عدد الفرق (وقت البداية بيصغر لأقرب حجم بيكفي الفرق المسجّلة)
  size integer not null check (size in (2, 4, 8, 16)),
  -- لكل لاعب بالفريق الفائز
  prize_coins integer not null default 0 check (prize_coins between 0 and 1000000),
  starts_at timestamptz,
  status text not null default 'open' check (status in ('open', 'running', 'finished', 'cancelled')),
  winner_team bigint,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.tournament_teams (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 20),
  p1 uuid not null references public.profiles (id) on delete cascade,
  p2 uuid not null references public.profiles (id) on delete cascade,
  eliminated boolean not null default false,
  created_at timestamptz not null default now()
);
create index tournament_teams_t_idx on public.tournament_teams (tournament_id);

create table public.tournament_matches (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments (id) on delete cascade,
  -- الجولة 1 أول جولة، وآخر جولة النهائي
  round integer not null,
  slot integer not null,
  team_a bigint references public.tournament_teams (id) on delete set null,
  team_b bigint references public.tournament_teams (id) on delete set null,
  game_id bigint references public.baloot_games (id) on delete set null,
  winner bigint references public.tournament_teams (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'playing', 'done')),
  unique (tournament_id, round, slot)
);

-- طاولة البلوت تبع المباراة
alter table public.baloot_games add column if not exists tournament_match bigint
  references public.tournament_matches (id) on delete set null;

alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.tournament_matches enable row level security;
revoke all on public.tournaments, public.tournament_teams, public.tournament_matches from anon, authenticated;
grant select on public.tournaments, public.tournament_teams, public.tournament_matches to authenticated;
create policy "everyone sees tournaments" on public.tournaments for select to authenticated using (true);
create policy "everyone sees tournament teams" on public.tournament_teams for select to authenticated using (true);
create policy "everyone sees tournament matches" on public.tournament_matches for select to authenticated using (true);
alter publication supabase_realtime add table public.tournaments, public.tournament_teams, public.tournament_matches;

create function public.admin_create_tournament(title text, size integer, prize integer, starts timestamptz)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid bigint;
begin
  perform public._require_admin();
  insert into public.tournaments (title, size, prize_coins, starts_at, created_by)
  values (title, size, prize, starts, auth.uid())
  returning id into tid;
  return tid;
end;
$$;

-- التسجيل: إنت وشريكك (برقم الـ ID تبعه)
create function public.tournament_register(tid bigint, partner bigint, team_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tournaments;
  me uuid := auth.uid();
  mate uuid;
  team bigint;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into t from public.tournaments where id = tid for update;
  if not found then raise exception 'tournament not found'; end if;
  if t.status <> 'open' then raise exception 'registration closed'; end if;
  if (select count(*) from public.tournament_teams where tournament_id = tid) >= t.size then raise exception 'tournament full'; end if;
  select id into mate from public.profiles where public_id = partner;
  if mate is null then raise exception 'partner not found'; end if;
  if mate = me then raise exception 'partner is you'; end if;
  if exists (select 1 from public.profiles where id in (me, mate) and banned_until > now()) then raise exception 'banned'; end if;
  if exists (select 1 from public.tournament_teams where tournament_id = tid and (p1 in (me, mate) or p2 in (me, mate))) then
    raise exception 'already registered';
  end if;
  insert into public.tournament_teams (tournament_id, name, p1, p2) values (tid, btrim(team_name), me, mate)
  returning id into team;
  return team;
end;
$$;

-- الانسحاب قبل ما تبلّش (أي واحد من الفريق)
create function public.tournament_leave(tid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.tournaments where id = tid and status = 'open') then raise exception 'registration closed'; end if;
  delete from public.tournament_teams where tournament_id = tid and (p1 = auth.uid() or p2 = auth.uid());
end;
$$;

-- لاعب بطولة بشكل لاعب بلوت
create function public._tr_player(uid uuid, seat integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('uid', id, 'pid', public_id, 'name', coalesce(name, 'لاعب'), 'avatar', avatar,
    'seat', seat, 'bot', false, 'left', false, 'count', 0)
  from public.profiles where id = uid
$$;

-- طاولة بلوت للمباراة: الفريق A بالمقعد 0 و2، والفريق B بالمقعد 1 و3
create function public._tr_make_game(mid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.tournament_matches;
  a public.tournament_teams;
  b public.tournament_teams;
  g public.baloot_games;
begin
  select * into m from public.tournament_matches where id = mid for update;
  if m.game_id is not null or m.team_a is null or m.team_b is null then return; end if;
  select * into a from public.tournament_teams where id = m.team_a;
  select * into b from public.tournament_teams where id = m.team_b;
  insert into public.baloot_games (host, players, tournament_match)
  values (a.p1, jsonb_build_array(public._tr_player(a.p1, 0), public._tr_player(b.p1, 1),
    public._tr_player(a.p2, 2), public._tr_player(b.p2, 3)), mid)
  returning * into g;
  g.status := 'playing';
  g.scores := array[0, 0];
  g.round := 0;
  g.dealer := floor(random() * 4)::integer;
  perform public._bl_save(public._bl_deal(g));
  update public.tournament_matches set game_id = g.id, status = 'playing' where id = mid;
end;
$$;

-- رابح المباراة بيطلع لمباراة الجولة الجاية (أو بيربح البطولة إذا هي النهائي)
create function public._tr_advance(mid bigint, win bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.tournament_matches;
  t public.tournaments;
  last_round integer;
  nxt bigint;
  team public.tournament_teams;
begin
  select * into m from public.tournament_matches where id = mid for update;
  if m.status = 'done' then return; end if;
  update public.tournament_matches set winner = win, status = 'done' where id = mid;
  update public.tournament_teams set eliminated = true
  where id in (m.team_a, m.team_b) and id <> win;

  select * into t from public.tournaments where id = m.tournament_id for update;
  last_round := (ln(t.size) / ln(2))::integer;
  if m.round >= last_round then
    update public.tournaments set status = 'finished', winner_team = win where id = t.id;
    select * into team from public.tournament_teams where id = win;
    if t.prize_coins > 0 then
      update public.profiles set coins = coins + t.prize_coins where id in (team.p1, team.p2);
    end if;
    return;
  end if;

  insert into public.tournament_matches (tournament_id, round, slot)
  values (t.id, m.round + 1, m.slot / 2)
  on conflict (tournament_id, round, slot) do nothing;
  if m.slot % 2 = 0 then
    update public.tournament_matches set team_a = win
    where tournament_id = t.id and round = m.round + 1 and slot = m.slot / 2 returning id into nxt;
  else
    update public.tournament_matches set team_b = win
    where tournament_id = t.id and round = m.round + 1 and slot = m.slot / 2 returning id into nxt;
  end if;
  perform public._tr_make_game(nxt);
end;
$$;

-- لما تخلص طاولة بطولة، الرابح بيطلع لحاله
create function public._tr_game_finished()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.tournament_matches;
begin
  select * into m from public.tournament_matches where id = new.tournament_match;
  if found and m.status <> 'done' then
    perform public._tr_advance(m.id, case when new.winner = 0 then m.team_a else m.team_b end);
  end if;
  return null;
end;
$$;

create trigger baloot_tournament_finished
  after update of status on public.baloot_games
  for each row
  when (new.status = 'finished' and old.status <> 'finished' and new.tournament_match is not null)
  execute function public._tr_game_finished();

-- البداية: الفرق بترتيب عشوائي، واللي ما إله خصم (الأماكن الفاضية) بيطلع للجولة التانية مباشرة
create function public.admin_start_tournament(tid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tournaments;
  teams bigint[];
  n integer;
  i integer;
  mid bigint;
  a bigint;
  b bigint;
begin
  perform public._require_admin();
  select * into t from public.tournaments where id = tid for update;
  if not found or t.status <> 'open' then raise exception 'not open'; end if;
  select array_agg(id order by random()) into teams from public.tournament_teams where tournament_id = tid;
  n := coalesce(cardinality(teams), 0);
  if n < 2 then raise exception 'need 2 teams'; end if;
  -- أصغر شجرة بتكفي الفرق، عشان كل مباراة بالجولة الأولى فيها فريق واحد ع الأقل
  t.size := 2;
  while t.size < n loop t.size := t.size * 2; end loop;
  update public.tournaments set status = 'running', size = t.size, starts_at = coalesce(starts_at, now()) where id = tid;
  -- الفرق بالأماكن الزوجية أول، عشان الفاضي (bye) يتوزع وما يجتمع فاضيين بمباراة وحدة
  for i in 0..(t.size / 2 - 1) loop
    a := teams[i + 1];
    b := case when t.size / 2 + i + 1 <= n then teams[t.size / 2 + i + 1] end;
    insert into public.tournament_matches (tournament_id, round, slot, team_a, team_b)
    values (tid, 1, i, a, b) returning id into mid;
    if b is null then
      perform public._tr_advance(mid, a);
    else
      perform public._tr_make_game(mid);
    end if;
  end loop;
end;
$$;

-- الأدمن بيحسم مباراة (فريق ما إجا مثلاً). side: a أو b
create function public.admin_set_match_winner(mid bigint, side text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.tournament_matches;
begin
  perform public._require_admin();
  select * into m from public.tournament_matches where id = mid;
  if not found or m.status = 'done' then raise exception 'match not open'; end if;
  if side not in ('a', 'b') or (side = 'a' and m.team_a is null) or (side = 'b' and m.team_b is null) then raise exception 'bad side'; end if;
  -- الطاولة القديمة بتخلص بدون جوائز
  update public.baloot_games set status = 'finished', deadline = null, tournament_match = null where id = m.game_id and status <> 'finished';
  perform public._tr_advance(mid, case when side = 'a' then m.team_a else m.team_b end);
end;
$$;

create function public.admin_cancel_tournament(tid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_admin();
  update public.tournaments set status = 'cancelled' where id = tid and status in ('open', 'running');
  update public.baloot_games set status = 'finished', deadline = null
  where tournament_match in (select id from public.tournament_matches where tournament_id = tid) and status <> 'finished';
end;
$$;

revoke execute on function public._tr_player(uuid, integer), public._tr_make_game(bigint), public._tr_advance(bigint, bigint)
  from public, anon, authenticated;
revoke execute on function public.admin_create_tournament(text, integer, integer, timestamptz),
  public.tournament_register(bigint, bigint, text), public.tournament_leave(bigint),
  public.admin_start_tournament(bigint), public.admin_set_match_winner(bigint, text),
  public.admin_cancel_tournament(bigint) from public, anon;
grant execute on function public.admin_create_tournament(text, integer, integer, timestamptz),
  public.tournament_register(bigint, bigint, text), public.tournament_leave(bigint),
  public.admin_start_tournament(bigint), public.admin_set_match_winner(bigint, text),
  public.admin_cancel_tournament(bigint) to authenticated;
