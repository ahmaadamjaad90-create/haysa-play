-- طاولة الزهر
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0016)
--
-- لاعبين. اللوح ٢٤ بيت: board[i] موجب = أحجار اللاعب ٠، سالب = أحجار اللاعب ١.
-- اللاعب ٠ بيمشي من ٢٤ لـ ١ (بيته ١-٦)، واللاعب ١ بيمشي من ١ لـ ٢٤ (بيته ١٩-٢٤).
-- بالأوامر: البار للاعب ٠ = ٢٥ وللاعب ١ = ٠، والطلوع برا للاعب ٠ = ٠ وللاعب ١ = ٢٥.
-- الزهر بينرمي بالسيرفر، والحركات بتنفحص هون، مع قاعدة "لازم تستخدم الزهرين إذا بتقدر".

create table public.bg_games (
  id bigint generated always as identity (start with 2001) primary key,
  host uuid references public.profiles (id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  -- [{uid, pid, name, avatar, seat, bot, left}]
  players jsonb not null default '[]',
  board integer[] not null default array[
    -2, 0, 0, 0, 0, 5,  0, 3, 0, 0, 0, -5,  5, 0, 0, 0, -3, 0,  -5, 0, 0, 0, 0, 2],
  bar integer[] not null default array[0, 0],
  off integer[] not null default array[0, 0],
  turn integer,
  phase text check (phase in ('roll', 'move')),
  -- الزهر اللي ضل، واللي انرمى
  dice integer[] not null default '{}',
  rolled integer[] not null default '{}',
  -- الحركات المسموحة هلأ: [[from, to], ...]
  legal jsonb not null default '[]',
  last jsonb,
  winner integer,
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bg_games_waiting_idx on public.bg_games (status, updated_at desc);
alter table public.bg_games enable row level security;
revoke all on public.bg_games from anon, authenticated;
grant select on public.bg_games to authenticated;
create policy "everyone can watch backgammon" on public.bg_games for select to authenticated using (true);
alter publication supabase_realtime add table public.bg_games;

create table public.bg_results (
  game_id bigint not null references public.bg_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  won boolean not null,
  coins integer not null,
  xp integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index bg_results_user_idx on public.bg_results (user_id, created_at desc);
alter table public.bg_results enable row level security;
revoke all on public.bg_results from anon, authenticated;
grant select on public.bg_results to authenticated;
create policy "users read their backgammon results" on public.bg_results for select to authenticated
  using ((select auth.uid()) = user_id);

-- ===== المنطق: "منظور" اللاعب =====
-- s[1..24] البيوت (أحجاري موجبة وبمشي لتحت)، s[25] باري، s[26] بار الخصم، s[27] طلّعت، s[28] طلّع الخصم.
-- من البار = ٢٥، والطلوع = ٠.

create function public._bg_view(g public.bg_games, seat integer)
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select case when seat = 0 then
    g.board || array[g.bar[1], g.bar[2], g.off[1], g.off[2]]
  else
    array(select -g.board[25 - i] from generate_series(1, 24) i) || array[g.bar[2], g.bar[1], g.off[2], g.off[1]]
  end
$$;

-- رجوع من المنظور للوح الحقيقي
create function public._bg_unview(g public.bg_games, seat integer, s integer[])
returns public.bg_games
language plpgsql
immutable
set search_path = ''
as $$
begin
  if seat = 0 then
    g.board := s[1:24];
    g.bar := array[s[25], s[26]];
    g.off := array[s[27], s[28]];
  else
    g.board := array(select -s[25 - i] from generate_series(1, 24) i);
    g.bar := array[s[26], s[25]];
    g.off := array[s[28], s[27]];
  end if;
  return g;
end;
$$;

-- كل الحركات الممكنة برقم زهر واحد
create function public._bg_moves(s integer[], d integer)
returns table (f integer, t integer)
language plpgsql
immutable
set search_path = ''
as $$
declare
  p integer;
  home_only boolean;
begin
  if s[25] > 0 then
    if s[25 - d] >= -1 then f := 25; t := 25 - d; return next; end if;
    return;
  end if;
  home_only := not exists (select 1 from generate_series(7, 24) i where s[i] > 0);
  for p in 1..24 loop
    continue when s[p] <= 0;
    if p - d >= 1 then
      if s[p - d] >= -1 then f := p; t := p - d; return next; end if;
    elsif home_only then
      -- طلوع: بالرقم بالضبط، أو برقم أكبر إذا ما في أحجار أبعد
      if p - d = 0 or not exists (select 1 from generate_series(p + 1, 6) i where s[i] > 0) then
        f := p; t := 0; return next;
      end if;
    end if;
  end loop;
end;
$$;

create function public._bg_apply(s integer[], f integer, t integer)
returns integer[]
language plpgsql
immutable
set search_path = ''
as $$
begin
  if f = 25 then s[25] := s[25] - 1; else s[f] := s[f] - 1; end if;
  if t = 0 then
    s[27] := s[27] + 1;
  else
    if s[t] = -1 then
      s[t] := 0;
      s[26] := s[26] + 1;
    end if;
    s[t] := s[t] + 1;
  end if;
  return s;
end;
$$;

create function public._bg_minus(dice integer[], d integer)
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(dice[:array_position(dice, d) - 1], '{}') || coalesce(dice[array_position(dice, d) + 1:], '{}')
$$;

-- أكبر عدد زهر بينفع ينلعب من هالوضع
create function public._bg_max(s integer[], dice integer[])
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  d integer;
  m record;
  best integer := 0;
  r integer;
begin
  if cardinality(dice) = 0 then return 0; end if;
  for d in select distinct x from unnest(dice) x loop
    for m in select * from public._bg_moves(s, d) loop
      r := 1 + public._bg_max(public._bg_apply(s, m.f, m.t), public._bg_minus(dice, d));
      if r > best then best := r; end if;
      if best = cardinality(dice) then return best; end if;
    end loop;
  end loop;
  return best;
end;
$$;

-- الحركات المسموحة (بالمنظور): [f, t, d]
create function public._bg_legal_view(s integer[], dice integer[])
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  total integer := public._bg_max(s, dice);
  d integer;
  m record;
  out jsonb := '[]';
  biggest integer;
begin
  if total = 0 then return '[]'; end if;
  for d in select distinct x from unnest(dice) x order by x loop
    for m in select * from public._bg_moves(s, d) loop
      if 1 + public._bg_max(public._bg_apply(s, m.f, m.t), public._bg_minus(dice, d)) = total then
        out := out || jsonb_build_array(jsonb_build_array(m.f, m.t, d));
      end if;
    end loop;
  end loop;
  -- إذا بينفع زهر واحد بس من زهرين مختلفين، لازم الأكبر (إذا بينفع)
  if total = 1 and cardinality(dice) = 2 and dice[1] <> dice[2] then
    select max((x ->> 2)::integer) into biggest from jsonb_array_elements(out) x;
    select coalesce(jsonb_agg(x), '[]') into out from jsonb_array_elements(out) x where (x ->> 2)::integer = biggest;
  end if;
  return out;
end;
$$;

-- الحركات المسموحة للي عليه الدور، بإحداثيات اللوح الحقيقية
create function public._bg_legal(g public.bg_games)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_array(
      case when g.turn = 0 then (x ->> 0)::integer else 25 - (x ->> 0)::integer end,
      case when g.turn = 0 then (x ->> 1)::integer else 25 - (x ->> 1)::integer end,
      (x ->> 2)::integer)), '[]')
  from jsonb_array_elements(public._bg_legal_view(public._bg_view(g, g.turn), g.dice)) x
$$;

create function public._bg_is_bot(g public.bg_games, s integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce((select (p ->> 'bot')::boolean from jsonb_array_elements(g.players) p where (p ->> 'seat')::integer = s), false)
$$;

create function public._bg_deadline(g public.bg_games)
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now() + case when public._bg_is_bot(g, g.turn) then interval '1 second' else interval '30 seconds' end $$;

create function public._bg_next(g public.bg_games)
returns public.bg_games
language plpgsql
stable
set search_path = ''
as $$
begin
  g.turn := 1 - g.turn;
  g.phase := 'roll';
  g.dice := '{}';
  g.legal := '[]';
  g.deadline := public._bg_deadline(g);
  return g;
end;
$$;

-- النهاية: الرابح ٥٠ XP و١٠٠ عملة (ضد لاعب حقيقي، لحد ١٠ باليوم)، والخسران ١٥ XP
create function public._bg_finish(g public.bg_games, w integer)
returns public.bg_games
language plpgsql
set search_path = ''
as $$
declare
  p jsonb;
  humans integer;
  won boolean;
  c integer;
  today integer;
begin
  g.status := 'finished';
  g.winner := w;
  g.phase := null;
  g.legal := '[]';
  g.deadline := null;
  select count(*) into humans from jsonb_array_elements(g.players) q where not (q ->> 'bot')::boolean;
  for p in select * from jsonb_array_elements(g.players) loop
    continue when (p ->> 'bot')::boolean;
    won := (p ->> 'seat')::integer = w;
    c := 0;
    if won and humans >= 2 then
      select count(*) into today from public.bg_results
      where user_id = (p ->> 'uid')::uuid and coins > 0 and created_at >= now() - interval '1 day';
      if today < 10 then c := 100; end if;
    end if;
    insert into public.bg_results (game_id, user_id, won, coins, xp)
    values (g.id, (p ->> 'uid')::uuid, won, c, case when won then 50 else 15 end)
    on conflict do nothing;
    if found then
      update public.profiles set xp = xp + case when won then 50 else 15 end, coins = coins + c
      where id = (p ->> 'uid')::uuid;
    end if;
  end loop;
  return g;
end;
$$;

create function public._bg_roll(g public.bg_games)
returns public.bg_games
language plpgsql
volatile
set search_path = ''
as $$
declare
  a integer := 1 + floor(random() * 6)::integer;
  b integer := 1 + floor(random() * 6)::integer;
begin
  g.rolled := array[a, b];
  g.dice := case when a = b then array[a, a, a, a] else array[a, b] end;
  g.legal := public._bg_legal(g);
  if jsonb_array_length(g.legal) = 0 then
    g.last := jsonb_build_object('seat', g.turn, 'roll', g.rolled, 'stuck', true);
    return public._bg_next(g);
  end if;
  g.last := jsonb_build_object('seat', g.turn, 'roll', g.rolled);
  g.phase := 'move';
  g.deadline := public._bg_deadline(g);
  return g;
end;
$$;

-- حركة وحدة (من، لـ) بإحداثيات اللوح
create function public._bg_move(g public.bg_games, f integer, t integer)
returns public.bg_games
language plpgsql
set search_path = ''
as $$
declare
  m jsonb;
  vf integer := case when g.turn = 0 then f else 25 - f end;
  vt integer := case when g.turn = 0 then t else 25 - t end;
  s integer[];
  hit boolean;
begin
  select x into m from jsonb_array_elements(g.legal) x
  where (x ->> 0)::integer = f and (x ->> 1)::integer = t
  order by (x ->> 2)::integer limit 1;
  if m is null then raise exception 'illegal move'; end if;

  s := public._bg_view(g, g.turn);
  hit := vt between 1 and 24 and s[vt] = -1;
  s := public._bg_apply(s, vf, vt);
  g := public._bg_unview(g, g.turn, s);
  g.dice := public._bg_minus(g.dice, (m ->> 2)::integer);
  g.last := jsonb_build_object('seat', g.turn, 'from', f, 'to', t, 'hit', hit, 'roll', g.rolled);

  if g.off[g.turn + 1] = 15 then
    return public._bg_finish(g, g.turn);
  end if;
  g.legal := public._bg_legal(g);
  if cardinality(g.dice) = 0 or jsonb_array_length(g.legal) = 0 then
    return public._bg_next(g);
  end if;
  g.deadline := public._bg_deadline(g);
  return g;
end;
$$;

-- الكمبيوتر (أو اللي خلص وقته): أكل > طلوع > أبعد حجر
create function public._bg_auto(g public.bg_games)
returns public.bg_games
language plpgsql
volatile
set search_path = ''
as $$
declare
  m jsonb;
  s integer[];
begin
  if g.phase = 'roll' then
    return public._bg_roll(g);
  end if;
  s := public._bg_view(g, g.turn);
  select x into m from jsonb_array_elements(g.legal) x
  order by
    (case when (case when g.turn = 0 then (x ->> 1)::integer else 25 - (x ->> 1)::integer end) between 1 and 24
          and s[case when g.turn = 0 then (x ->> 1)::integer else 25 - (x ->> 1)::integer end] = -1 then 2 else 0 end
     + case when (x ->> 1)::integer in (0, 25) and (x ->> 0)::integer not in (0, 25) then 1 else 0 end) desc,
    random()
  limit 1;
  return public._bg_move(g, (m ->> 0)::integer, (m ->> 1)::integer);
end;
$$;

create function public._bg_save(g public.bg_games)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  g.updated_at := now();
  update public.bg_games set
    host = g.host, status = g.status, players = g.players, board = g.board, bar = g.bar, off = g.off,
    turn = g.turn, phase = g.phase, dice = g.dice, rolled = g.rolled, legal = g.legal, last = g.last,
    winner = g.winner, deadline = g.deadline, updated_at = g.updated_at
  where id = g.id;
  return to_jsonb(g);
end;
$$;

create function public._bg_me_json()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('uid', id, 'pid', public_id, 'name', coalesce(name, 'لاعب'),
    'avatar', avatar, 'seat', 0, 'bot', false, 'left', false)
  from public.profiles where id = auth.uid()
$$;

create function public._bg_my_seat(g public.bg_games)
returns integer
language sql
stable
set search_path = ''
as $$
  select (p ->> 'seat')::integer from jsonb_array_elements(g.players) p
  where p ->> 'uid' = auth.uid()::text and not (p ->> 'left')::boolean
$$;

revoke execute on function public._bg_view(public.bg_games, integer), public._bg_unview(public.bg_games, integer, integer[]),
  public._bg_moves(integer[], integer), public._bg_apply(integer[], integer, integer), public._bg_minus(integer[], integer),
  public._bg_max(integer[], integer[]), public._bg_legal_view(integer[], integer[]), public._bg_legal(public.bg_games),
  public._bg_is_bot(public.bg_games, integer), public._bg_deadline(public.bg_games), public._bg_next(public.bg_games),
  public._bg_finish(public.bg_games, integer), public._bg_roll(public.bg_games), public._bg_move(public.bg_games, integer, integer),
  public._bg_auto(public.bg_games), public._bg_save(public.bg_games), public._bg_me_json(), public._bg_my_seat(public.bg_games)
from public, anon, authenticated;

-- ===== اللي بيناديه التطبيق =====

create function public.bg_create()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.bg_games (host, players) values (auth.uid(), jsonb_build_array(public._bg_me_json()))
  returning id into gid;
  return gid;
end;
$$;

create function public.bg_join(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.bg_games;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from public.bg_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if exists (select 1 from jsonb_array_elements(g.players) p where p ->> 'uid' = auth.uid()::text) then
    return to_jsonb(g);
  end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) >= 2 then raise exception 'game full'; end if;
  g.players := g.players || jsonb_set(public._bg_me_json(), '{seat}', '1');
  return public._bg_save(g);
end;
$$;

create function public.bg_add_bot(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.bg_games;
begin
  select * into g from public.bg_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) >= 2 then raise exception 'game full'; end if;
  g.players := g.players || jsonb_build_object('uid', null, 'pid', null, 'name', 'الدلّة',
    'avatar', 'dalla', 'seat', 1, 'bot', true, 'left', false);
  return public._bg_save(g);
end;
$$;

create function public.bg_start(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.bg_games;
begin
  select * into g from public.bg_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) < 2 then raise exception 'need 2 players'; end if;
  g.status := 'playing';
  g.turn := floor(random() * 2)::integer;
  g.phase := 'roll';
  g.last := null;
  g.deadline := public._bg_deadline(g);
  return public._bg_save(g);
end;
$$;

create function public.bg_roll(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.bg_games;
begin
  select * into g from public.bg_games where id = gid for update;
  if not found or g.status <> 'playing' then raise exception 'not playing'; end if;
  if public._bg_my_seat(g) is distinct from g.turn then raise exception 'not your turn'; end if;
  if g.phase <> 'roll' then raise exception 'already rolled'; end if;
  return public._bg_save(public._bg_roll(g));
end;
$$;

create function public.bg_move(gid bigint, f integer, t integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.bg_games;
begin
  select * into g from public.bg_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase <> 'move' then raise exception 'not moving'; end if;
  if public._bg_my_seat(g) is distinct from g.turn then raise exception 'not your turn'; end if;
  return public._bg_save(public._bg_move(g, f, t));
end;
$$;

create function public.bg_tick(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.bg_games;
begin
  select * into g from public.bg_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if g.status <> 'playing' or g.deadline > now() then return to_jsonb(g); end if;
  return public._bg_save(public._bg_auto(g));
end;
$$;

create function public.bg_leave(gid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.bg_games;
  i integer;
  s integer;
begin
  select * into g from public.bg_games where id = gid for update;
  if not found or g.status = 'finished' then return; end if;
  select (ord - 1)::integer into i from jsonb_array_elements(g.players) with ordinality as x(p, ord)
  where p ->> 'uid' = auth.uid()::text;
  if i is null then return; end if;

  if g.status = 'waiting' then
    g.players := g.players - i;
    if g.host = auth.uid() then
      g.host := (select (p ->> 'uid')::uuid from jsonb_array_elements(g.players) p where not (p ->> 'bot')::boolean limit 1);
    end if;
    if g.host is null then
      g.status := 'finished';
    else
      -- اللي ضل بيصير المقعد ٠
      g.players := jsonb_build_array(jsonb_set(g.players -> 0, '{seat}', '0'));
    end if;
    perform public._bg_save(g);
    return;
  end if;

  s := (g.players -> i ->> 'seat')::integer;
  g.players := jsonb_set(g.players, array[i::text, 'left'], 'true');
  g := public._bg_finish(g, 1 - s);
  perform public._bg_save(g);
end;
$$;

grant execute on function public.bg_create(), public.bg_join(bigint), public.bg_add_bot(bigint), public.bg_start(bigint),
  public.bg_roll(bigint), public.bg_move(bigint, integer, integer), public.bg_tick(bigint), public.bg_leave(bigint)
to authenticated;
revoke execute on function public.bg_create(), public.bg_join(bigint), public.bg_add_bot(bigint), public.bg_start(bigint),
  public.bg_roll(bigint), public.bg_move(bigint, integer, integer), public.bg_tick(bigint), public.bg_leave(bigint)
from public, anon;
