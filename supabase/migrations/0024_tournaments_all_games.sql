-- بطولات لكل ألعاب المواجهة، وجائزة جواهر
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0023)
--
-- فرق من اتنين: البلوت والكوت. لاعب ضد لاعب: لودو، ألوان، دومينو، طاولة الزهر، تحدي الأسئلة.
-- (الجاسوس والمافيا واحزر الرسمة وكلمات السر ألعاب جماعية، ما بتنفع خروج مغلوب.)
-- طاولة كل مباراة بتنعمل بنفس دوال اللعبة (create/join/start) باسم اللاعبين نفسهم.

alter table public.tournaments drop constraint if exists tournaments_game_check;
alter table public.tournaments add constraint tournaments_game_check
  check (game in ('baloot', 'kout', 'ludo', 'colors', 'domino', 'backgammon', 'trivia'));
alter table public.tournaments add column if not exists prize_gems integer not null default 0
  check (prize_gems between 0 and 1000000);
-- بالألعاب الفردية الفريق لاعب واحد
alter table public.tournament_teams alter column p2 drop not null;

alter table public.ludo_games add column if not exists tournament_match bigint references public.tournament_matches (id) on delete set null;
alter table public.colors_games add column if not exists tournament_match bigint references public.tournament_matches (id) on delete set null;
alter table public.trivia_games add column if not exists tournament_match bigint references public.tournament_matches (id) on delete set null;
alter table public.dom_games add column if not exists tournament_match bigint references public.tournament_matches (id) on delete set null;
alter table public.bg_games add column if not exists tournament_match bigint references public.tournament_matches (id) on delete set null;
alter table public.kout_games add column if not exists tournament_match bigint references public.tournament_matches (id) on delete set null;
-- رقم الطاولة بالمباراة بيكون من أي جدول، فما في ربط مباشر مع البلوت
alter table public.tournament_matches drop constraint if exists tournament_matches_game_id_fkey;

-- اسم الجدول وأول اسم دوال كل لعبة
create function public._tr_game(game text, out tbl text, out fn text, out teams boolean)
language sql
immutable
set search_path = ''
as $$
  select v.tbl, v.fn, v.teams from (values
    ('baloot', 'baloot_games', 'baloot', true),
    ('kout', 'kout_games', 'kout', true),
    ('ludo', 'ludo_games', 'ludo', false),
    ('colors', 'colors_games', 'colors', false),
    ('domino', 'dom_games', 'dom', false),
    ('backgammon', 'bg_games', 'bg', false),
    ('trivia', 'trivia_games', 'trivia', false)
  ) v(game, tbl, fn, teams) where v.game = $1
$$;

-- طاولة المباراة: صاحب أول مقعد بيفتحها، والباقي بينضموا بالترتيب، وبعدين بتبلّش.
-- بالفرق: A1 ثم B1 ثم A2 ثم B2، فالمقعد 0 و2 للفريق A و1 و3 للفريق B.
create or replace function public._tr_make_game(mid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.tournament_matches;
  t public.tournaments;
  a public.tournament_teams;
  b public.tournament_teams;
  info record;
  seats uuid[];
  prev text := current_setting('request.jwt.claim.sub', true);
  gid bigint;
  i integer;
begin
  select * into m from public.tournament_matches where id = mid for update;
  if m.game_id is not null or m.team_a is null or m.team_b is null then return; end if;
  select * into t from public.tournaments where id = m.tournament_id;
  select * into a from public.tournament_teams where id = m.team_a;
  select * into b from public.tournament_teams where id = m.team_b;
  info := public._tr_game(t.game);
  seats := case when info.teams then array[a.p1, b.p1, a.p2, b.p2] else array[a.p1, b.p1] end;

  -- منلعب دور كل لاعب (auth.uid) عشان دوال اللعبة نفسها تشتغل متل العادة
  perform set_config('request.jwt.claim.sub', seats[1]::text, true);
  execute format('select public.%I()', info.fn || '_create') into gid;
  for i in 2..cardinality(seats) loop
    perform set_config('request.jwt.claim.sub', seats[i]::text, true);
    execute format('select public.%I($1)', info.fn || '_join') using gid;
  end loop;
  perform set_config('request.jwt.claim.sub', seats[1]::text, true);
  execute format('select public.%I($1)', info.fn || '_start') using gid;
  perform set_config('request.jwt.claim.sub', coalesce(prev, ''), true);

  execute format('update public.%I set tournament_match = $1 where id = $2', info.tbl) using mid, gid;
  update public.tournament_matches set game_id = gid, status = 'playing' where id = mid;
end;
$$;

create or replace function public._tr_advance(mid bigint, win bigint)
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
    update public.profiles set coins = coins + t.prize_coins, gems = gems + t.prize_gems
    where id in (team.p1, team.p2);
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

-- لما تخلص طاولة بطولة: منعرف اللاعب الرابح، وفريقه بيطلع
create or replace function public._tr_game_finished()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.tournament_matches;
  j jsonb := to_jsonb(new);
  w text := j ->> 'winner';
  wuid uuid;
  team bigint;
begin
  select * into m from public.tournament_matches where id = new.tournament_match;
  if not found or m.status = 'done' or w is null then return null; end if;
  if tg_table_name = 'trivia_games' then
    wuid := w::uuid;
  else
    -- بالفرق: الرابح رقم الفريق (0 أو 1) = فريق صاحب المقعد 0 أو 1. بالباقي: رقم مقعد الرابح.
    select (p ->> 'uid')::uuid into wuid from jsonb_array_elements(j -> 'players') p where (p ->> 'seat')::integer = w::integer;
  end if;
  select id into team from public.tournament_teams
  where id in (m.team_a, m.team_b) and wuid in (p1, p2);
  if team is not null then perform public._tr_advance(m.id, team); end if;
  return null;
end;
$$;

drop trigger if exists baloot_tournament_finished on public.baloot_games;
create trigger baloot_tournament_finished after update of status on public.baloot_games for each row
  when (new.status = 'finished' and old.status <> 'finished' and new.tournament_match is not null) execute function public._tr_game_finished();
create trigger kout_tournament_finished after update of status on public.kout_games for each row
  when (new.status = 'finished' and old.status <> 'finished' and new.tournament_match is not null) execute function public._tr_game_finished();
create trigger ludo_tournament_finished after update of status on public.ludo_games for each row
  when (new.status = 'finished' and old.status <> 'finished' and new.tournament_match is not null) execute function public._tr_game_finished();
create trigger colors_tournament_finished after update of status on public.colors_games for each row
  when (new.status = 'finished' and old.status <> 'finished' and new.tournament_match is not null) execute function public._tr_game_finished();
create trigger dom_tournament_finished after update of status on public.dom_games for each row
  when (new.status = 'finished' and old.status <> 'finished' and new.tournament_match is not null) execute function public._tr_game_finished();
create trigger bg_tournament_finished after update of status on public.bg_games for each row
  when (new.status = 'finished' and old.status <> 'finished' and new.tournament_match is not null) execute function public._tr_game_finished();
create trigger trivia_tournament_finished after update of status on public.trivia_games for each row
  when (new.status = 'finished' and old.status <> 'finished' and new.tournament_match is not null) execute function public._tr_game_finished();

-- إنهاء طاولة مباراة بدون رابح (لما الأدمن يحسم أو يلغي)
create function public._tr_close_game(mid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.tournament_matches;
  info record;
begin
  select * into m from public.tournament_matches where id = mid;
  if m.game_id is null then return; end if;
  info := public._tr_game((select game from public.tournaments where id = m.tournament_id));
  execute format('update public.%I set status = ''finished'', deadline = null, tournament_match = null where id = $1 and status <> ''finished''', info.tbl)
    using m.game_id;
end;
$$;

create or replace function public.admin_set_match_winner(mid bigint, side text)
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
  perform public._tr_close_game(mid);
  perform public._tr_advance(mid, case when side = 'a' then m.team_a else m.team_b end);
end;
$$;

create or replace function public.admin_cancel_tournament(tid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mid bigint;
begin
  perform public._require_admin();
  update public.tournaments set status = 'cancelled' where id = tid and status in ('open', 'running');
  for mid in select id from public.tournament_matches where tournament_id = tid and status = 'playing' loop
    perform public._tr_close_game(mid);
  end loop;
end;
$$;

drop function if exists public.admin_create_tournament(text, integer, integer, timestamptz);
create function public.admin_create_tournament(game text, title text, size integer, prize_coins integer, prize_gems integer, starts timestamptz)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid bigint;
begin
  perform public._require_admin();
  insert into public.tournaments (game, title, size, prize_coins, prize_gems, starts_at, created_by)
  values (game, title, size, prize_coins, prize_gems, starts, auth.uid())
  returning id into tid;
  return tid;
end;
$$;

-- التسجيل: بالفرق إنت وشريكك، وبالألعاب الفردية إنت لحالك (partner = null)
create or replace function public.tournament_register(tid bigint, partner bigint, team_name text)
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
  pair boolean;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into t from public.tournaments where id = tid for update;
  if not found then raise exception 'tournament not found'; end if;
  if t.status <> 'open' then raise exception 'registration closed'; end if;
  if (select count(*) from public.tournament_teams where tournament_id = tid) >= t.size then raise exception 'tournament full'; end if;
  pair := (public._tr_game(t.game)).teams;
  if pair then
    select id into mate from public.profiles where public_id = partner;
    if mate is null then raise exception 'partner not found'; end if;
    if mate = me then raise exception 'partner is you'; end if;
  end if;
  if exists (select 1 from public.profiles where id in (me, mate) and banned_until > now()) then raise exception 'banned'; end if;
  if exists (select 1 from public.tournament_teams where tournament_id = tid
             and (p1 in (me, mate) or p2 in (me, mate))) then
    raise exception 'already registered';
  end if;
  insert into public.tournament_teams (tournament_id, name, p1, p2)
  values (tid, coalesce(nullif(btrim(team_name), ''), (select coalesce(name, 'لاعب') from public.profiles where id = me)), me, mate)
  returning id into team;
  return team;
end;
$$;

revoke execute on function public._tr_game(text), public._tr_close_game(bigint) from public, anon, authenticated;
revoke execute on function public.admin_create_tournament(text, text, integer, integer, integer, timestamptz) from public, anon;
grant execute on function public.admin_create_tournament(text, text, integer, integer, integer, timestamptz) to authenticated;
