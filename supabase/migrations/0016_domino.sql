-- دومينو
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0015)
--
-- ٢٨ حجر (من ٠-٠ لـ ٦-٦)، كل لاعب ٧ أحجار، والباقي بالكومة.
-- بتنزّل حجر رقمه بيطابق أول السلسلة أو آخرها. إذا ما عندك، بتسحب من الكومة،
-- وإذا خلصت الكومة بيروح دورك. أول واحد بيخلّص أحجاره بيربح.
-- إذا تسكّرت (ما حدا بيقدر يلعب)، اللي مجموع نقاطه أقل بيربح.
-- الحجر مكتوب "a-b" (a أصغر أو بيساوي b). الأحجار والكومة مخبّاية بالسيرفر.

create table public.dom_games (
  id bigint generated always as identity (start with 8001) primary key,
  host uuid references public.profiles (id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  -- [{uid, pid, name, avatar, seat, bot, left, count}]
  players jsonb not null default '[]',
  -- السلسلة من اليسار لليمين: [[a, b], ...] بنفس اتجاه الوضع
  chain jsonb not null default '[]',
  pile integer not null default 0,
  turn integer,
  -- كم مرة ورا بعض ما حدا لعب (لما توصل لعدد اللاعبين = تسكّرت)
  passes integer not null default 0,
  last jsonb,
  winner integer,
  -- بآخر اللعبة: نقاط كل واحد
  pips jsonb,
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dom_games_waiting_idx on public.dom_games (status, updated_at desc);
alter table public.dom_games enable row level security;
revoke all on public.dom_games from anon, authenticated;
grant select on public.dom_games to authenticated;
create policy "everyone can watch domino" on public.dom_games for select to authenticated using (true);
alter publication supabase_realtime add table public.dom_games;

create table public.dom_hands (
  game_id bigint not null references public.dom_games (id) on delete cascade,
  seat integer not null,
  user_id uuid references public.profiles (id) on delete cascade,
  tiles text[] not null default '{}',
  primary key (game_id, seat)
);
alter table public.dom_hands enable row level security;
revoke all on public.dom_hands from anon, authenticated;
grant select on public.dom_hands to authenticated;
create policy "players read their own tiles" on public.dom_hands for select to authenticated
  using ((select auth.uid()) = user_id);

create table public.dom_piles (
  game_id bigint primary key references public.dom_games (id) on delete cascade,
  tiles text[] not null
);
alter table public.dom_piles enable row level security;
revoke all on public.dom_piles from anon, authenticated;

create table public.dom_results (
  game_id bigint not null references public.dom_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  won boolean not null,
  coins integer not null,
  xp integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index dom_results_user_idx on public.dom_results (user_id, created_at desc);
alter table public.dom_results enable row level security;
revoke all on public.dom_results from anon, authenticated;
grant select on public.dom_results to authenticated;
create policy "users read their domino results" on public.dom_results for select to authenticated
  using ((select auth.uid()) = user_id);

-- ===== دوال داخلية =====

create function public._dom_a(t text) returns integer language sql immutable set search_path = ''
as $$ select split_part(t, '-', 1)::integer $$;
create function public._dom_b(t text) returns integer language sql immutable set search_path = ''
as $$ select split_part(t, '-', 2)::integer $$;

-- طرفين السلسلة (null إذا فاضية)
create function public._dom_left(g public.dom_games) returns integer language sql immutable set search_path = ''
as $$ select (g.chain -> 0 ->> 0)::integer $$;
create function public._dom_right(g public.dom_games) returns integer language sql immutable set search_path = ''
as $$ select (g.chain -> -1 ->> 1)::integer $$;

-- بينفع هالحجر؟ (السلسلة الفاضية بتقبل أي حجر)
create function public._dom_fits(g public.dom_games, t text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_array_length(g.chain) = 0
    or public._dom_a(t) in (public._dom_left(g), public._dom_right(g))
    or public._dom_b(t) in (public._dom_left(g), public._dom_right(g))
$$;

create function public._dom_hand(gid bigint, s integer)
returns text[]
language sql
stable
set search_path = ''
as $$ select tiles from public.dom_hands where game_id = gid and seat = s $$;

create function public._dom_is_bot(g public.dom_games, s integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce((select (p ->> 'bot')::boolean from jsonb_array_elements(g.players) p where (p ->> 'seat')::integer = s), false)
$$;

create function public._dom_active(g public.dom_games)
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg((p ->> 'seat')::integer order by (p ->> 'seat')::integer), '{}')
  from jsonb_array_elements(g.players) p where not (p ->> 'left')::boolean
$$;

create function public._dom_next(g public.dom_games)
returns public.dom_games
language plpgsql
stable
set search_path = ''
as $$
declare
  seats integer[] := public._dom_active(g);
begin
  g.turn := coalesce((select min(x) from unnest(seats) x where x > g.turn), seats[1]);
  g.deadline := now() + case when public._dom_is_bot(g, g.turn) then interval '1.2 seconds' else interval '25 seconds' end;
  return g;
end;
$$;

create function public._dom_counts(g public.dom_games)
returns public.dom_games
language plpgsql
stable
set search_path = ''
as $$
declare
  i integer;
begin
  for i in 0..jsonb_array_length(g.players) - 1 loop
    g.players := jsonb_set(g.players, array[i::text, 'count'],
      to_jsonb(coalesce(cardinality(public._dom_hand(g.id, (g.players -> i ->> 'seat')::integer)), 0)));
  end loop;
  g.pile := coalesce((select cardinality(tiles) from public.dom_piles where game_id = g.id), 0);
  return g;
end;
$$;

-- النهاية: الرابح ٥٠ XP و١٠٠ عملة (إذا في لاعبين حقيقيين اتنين أو أكتر، لحد ١٠ باليوم)، والباقي ١٥ XP
create function public._dom_finish(g public.dom_games, w integer)
returns public.dom_games
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
  g.deadline := null;
  select jsonb_object_agg(seat::text, (select coalesce(sum(public._dom_a(t) + public._dom_b(t)), 0) from unnest(tiles) t))
  into g.pips from public.dom_hands where game_id = g.id;
  select count(*) into humans from jsonb_array_elements(g.players) q where not (q ->> 'bot')::boolean;
  for p in select * from jsonb_array_elements(g.players) loop
    continue when (p ->> 'bot')::boolean;
    won := (p ->> 'seat')::integer = w;
    c := 0;
    if won and humans >= 2 then
      select count(*) into today from public.dom_results
      where user_id = (p ->> 'uid')::uuid and coins > 0 and created_at >= now() - interval '1 day';
      if today < 10 then c := 100; end if;
    end if;
    insert into public.dom_results (game_id, user_id, won, coins, xp)
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

-- تسكّرت: اللي نقاطه أقل (التعادل للأقل مقعد)
create function public._dom_blocked(g public.dom_games)
returns public.dom_games
language plpgsql
set search_path = ''
as $$
declare
  w integer;
begin
  select h.seat into w from public.dom_hands h
  where h.game_id = g.id and h.seat = any (public._dom_active(g))
  order by (select coalesce(sum(public._dom_a(t) + public._dom_b(t)), 0) from unnest(h.tiles) t), h.seat
  limit 1;
  g.last := coalesce(g.last, '{}') || '{"blocked": true}';
  return public._dom_finish(g, w);
end;
$$;

-- تنزيل حجر عطرف (L أو R)
create function public._dom_play(g public.dom_games, t text, side text)
returns public.dom_games
language plpgsql
set search_path = ''
as $$
declare
  hand text[] := public._dom_hand(g.id, g.turn);
  a integer := public._dom_a(t);
  b integer := public._dom_b(t);
  l integer := public._dom_left(g);
  r integer := public._dom_right(g);
begin
  if not t = any (hand) then raise exception 'not in hand'; end if;
  if jsonb_array_length(g.chain) = 0 then
    g.chain := jsonb_build_array(jsonb_build_array(a, b));
  elsif side = 'L' and (a = l or b = l) then
    g.chain := jsonb_build_array(case when b = l then jsonb_build_array(a, b) else jsonb_build_array(b, a) end) || g.chain;
  elsif side = 'R' and (a = r or b = r) then
    g.chain := g.chain || jsonb_build_array(case when a = r then jsonb_build_array(a, b) else jsonb_build_array(b, a) end);
  else
    raise exception 'does not fit';
  end if;

  update public.dom_hands set tiles = array_remove(tiles, t) where game_id = g.id and seat = g.turn;
  g.passes := 0;
  g.last := jsonb_build_object('seat', g.turn, 'play', t, 'side', side);
  if cardinality(hand) = 1 then
    return public._dom_finish(public._dom_counts(g), g.turn);
  end if;
  return public._dom_counts(public._dom_next(g));
end;
$$;

-- ما عنده حجر بينفع: بيسحب لحد ما يلاقي، وإذا خلصت الكومة بيمرّر
create function public._dom_draw(g public.dom_games)
returns public.dom_games
language plpgsql
set search_path = ''
as $$
declare
  pile text[];
  t text;
  n integer := 0;
begin
  if exists (select 1 from unnest(public._dom_hand(g.id, g.turn)) x where public._dom_fits(g, x)) then
    raise exception 'you can play';
  end if;
  select tiles into pile from public.dom_piles where game_id = g.id for update;
  while cardinality(pile) > 0 loop
    t := pile[1];
    pile := pile[2:];
    n := n + 1;
    update public.dom_hands set tiles = tiles || t where game_id = g.id and seat = g.turn;
    exit when public._dom_fits(g, t);
  end loop;
  update public.dom_piles set tiles = pile where game_id = g.id;

  if exists (select 1 from unnest(public._dom_hand(g.id, g.turn)) x where public._dom_fits(g, x)) then
    g.last := jsonb_build_object('seat', g.turn, 'drew', n);
    g.deadline := now() + case when public._dom_is_bot(g, g.turn) then interval '1.2 seconds' else interval '25 seconds' end;
    return public._dom_counts(g);
  end if;

  g.passes := g.passes + 1;
  g.last := jsonb_build_object('seat', g.turn, 'drew', n, 'pass', true);
  if g.passes >= cardinality(public._dom_active(g)) then
    return public._dom_blocked(public._dom_counts(g));
  end if;
  return public._dom_counts(public._dom_next(g));
end;
$$;

-- الكمبيوتر (أو اللي خلص وقته): أتقل حجر بينفع
create function public._dom_auto(g public.dom_games)
returns public.dom_games
language plpgsql
set search_path = ''
as $$
declare
  t text;
  side text;
begin
  select x into t from unnest(public._dom_hand(g.id, g.turn)) x
  where public._dom_fits(g, x)
  order by public._dom_a(x) + public._dom_b(x) desc, random() limit 1;
  if t is null then
    return public._dom_draw(g);
  end if;
  side := case when jsonb_array_length(g.chain) = 0
               or public._dom_a(t) = public._dom_right(g) or public._dom_b(t) = public._dom_right(g)
          then 'R' else 'L' end;
  return public._dom_play(g, t, side);
end;
$$;

create function public._dom_save(g public.dom_games)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  g.updated_at := now();
  update public.dom_games set
    host = g.host, status = g.status, players = g.players, chain = g.chain, pile = g.pile, turn = g.turn,
    passes = g.passes, last = g.last, winner = g.winner, pips = g.pips, deadline = g.deadline,
    updated_at = g.updated_at
  where id = g.id;
  return to_jsonb(g);
end;
$$;

create function public._dom_me_json()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('uid', id, 'pid', public_id, 'name', coalesce(name, 'لاعب'),
    'avatar', avatar, 'seat', 0, 'bot', false, 'left', false, 'count', 0)
  from public.profiles where id = auth.uid()
$$;

create function public._dom_my_seat(g public.dom_games)
returns integer
language sql
stable
set search_path = ''
as $$
  select (p ->> 'seat')::integer from jsonb_array_elements(g.players) p
  where p ->> 'uid' = auth.uid()::text and not (p ->> 'left')::boolean
$$;

revoke execute on function public._dom_a(text), public._dom_b(text), public._dom_left(public.dom_games),
  public._dom_right(public.dom_games), public._dom_fits(public.dom_games, text), public._dom_hand(bigint, integer),
  public._dom_is_bot(public.dom_games, integer), public._dom_active(public.dom_games), public._dom_next(public.dom_games),
  public._dom_counts(public.dom_games), public._dom_finish(public.dom_games, integer), public._dom_blocked(public.dom_games),
  public._dom_play(public.dom_games, text, text), public._dom_draw(public.dom_games), public._dom_auto(public.dom_games),
  public._dom_save(public.dom_games), public._dom_me_json(), public._dom_my_seat(public.dom_games)
from public, anon, authenticated;

-- ===== اللي بيناديه التطبيق =====

create function public.dom_create()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.dom_games (host, players) values (auth.uid(), jsonb_build_array(public._dom_me_json()))
  returning id into gid;
  return gid;
end;
$$;

create function public.dom_join(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.dom_games;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from public.dom_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if exists (select 1 from jsonb_array_elements(g.players) p where p ->> 'uid' = auth.uid()::text) then
    return to_jsonb(g);
  end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) >= 4 then raise exception 'game full'; end if;
  g.players := g.players || jsonb_set(public._dom_me_json(), '{seat}', to_jsonb(jsonb_array_length(g.players)));
  return public._dom_save(g);
end;
$$;

create function public.dom_add_bot(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.dom_games;
  n integer;
begin
  select * into g from public.dom_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  n := jsonb_array_length(g.players);
  if n >= 4 then raise exception 'game full'; end if;
  g.players := g.players || jsonb_build_object('uid', null, 'pid', null,
    'name', (array['الدلّة', 'الفنجان', 'المبخرة'])[1 + (select count(*) from jsonb_array_elements(g.players) p where (p ->> 'bot')::boolean)::integer],
    'avatar', 'dalla', 'seat', n, 'bot', true, 'left', false, 'count', 0);
  return public._dom_save(g);
end;
$$;

-- البدء: خلط وتوزيع ٧ لكل واحد. اللي معه أكبر دبل بيبدأ.
create function public.dom_start(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.dom_games;
  n integer;
  tiles text[];
  p jsonb;
  s integer;
begin
  select * into g from public.dom_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  n := jsonb_array_length(g.players);
  if n < 2 then raise exception 'need 2 players'; end if;

  select array_agg(a || '-' || b order by random()) into tiles
  from generate_series(0, 6) a, generate_series(0, 6) b where a <= b;
  for p in select * from jsonb_array_elements(g.players) loop
    s := (p ->> 'seat')::integer;
    insert into public.dom_hands (game_id, seat, user_id, tiles) values (g.id, s, (p ->> 'uid')::uuid, tiles[1:7]);
    tiles := tiles[8:];
  end loop;
  insert into public.dom_piles (game_id, tiles) values (g.id, tiles);

  select h.seat into s from public.dom_hands h, unnest(h.tiles) t
  where h.game_id = g.id and public._dom_a(t) = public._dom_b(t)
  order by public._dom_a(t) desc limit 1;
  g.turn := coalesce(s, 0);
  g.status := 'playing';
  g.chain := '[]';
  g.passes := 0;
  g.last := null;
  g.deadline := now() + case when public._dom_is_bot(g, g.turn) then interval '1.2 seconds' else interval '25 seconds' end;
  return public._dom_save(public._dom_counts(g));
end;
$$;

create function public.dom_play(gid bigint, tile text, side text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.dom_games;
begin
  select * into g from public.dom_games where id = gid for update;
  if not found or g.status <> 'playing' then raise exception 'not playing'; end if;
  if public._dom_my_seat(g) is distinct from g.turn then raise exception 'not your turn'; end if;
  return public._dom_save(public._dom_play(g, tile, side));
end;
$$;

create function public.dom_draw(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.dom_games;
begin
  select * into g from public.dom_games where id = gid for update;
  if not found or g.status <> 'playing' then raise exception 'not playing'; end if;
  if public._dom_my_seat(g) is distinct from g.turn then raise exception 'not your turn'; end if;
  return public._dom_save(public._dom_draw(g));
end;
$$;

create function public.dom_tick(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.dom_games;
begin
  select * into g from public.dom_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if g.status <> 'playing' or g.deadline > now() then return to_jsonb(g); end if;
  return public._dom_save(public._dom_auto(g));
end;
$$;

create function public.dom_leave(gid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.dom_games;
  i integer;
  s integer;
  active integer[];
begin
  select * into g from public.dom_games where id = gid for update;
  if not found or g.status = 'finished' then return; end if;
  select (ord - 1)::integer into i from jsonb_array_elements(g.players) with ordinality as x(p, ord)
  where p ->> 'uid' = auth.uid()::text;
  if i is null then return; end if;

  if g.status = 'waiting' then
    g.players := g.players - i;
    for s in 0..jsonb_array_length(g.players) - 1 loop
      g.players := jsonb_set(g.players, array[s::text, 'seat'], to_jsonb(s));
    end loop;
    if g.host = auth.uid() then
      g.host := (select (p ->> 'uid')::uuid from jsonb_array_elements(g.players) p
                 where not (p ->> 'bot')::boolean limit 1);
    end if;
    if g.host is null then g.status := 'finished'; end if;
    perform public._dom_save(g);
    return;
  end if;

  s := (g.players -> i ->> 'seat')::integer;
  if g.turn = s then
    g := public._dom_next(g);
  end if;
  g.players := jsonb_set(g.players, array[i::text, 'left'], 'true');
  active := public._dom_active(g);
  if cardinality(active) = 1 then
    g := public._dom_finish(g, active[1]);
  elsif not exists (select 1 from jsonb_array_elements(g.players) p
                    where not (p ->> 'left')::boolean and not (p ->> 'bot')::boolean) then
    g.status := 'finished';
    g.deadline := null;
  end if;
  perform public._dom_save(g);
end;
$$;

grant execute on function public.dom_create(), public.dom_join(bigint), public.dom_add_bot(bigint),
  public.dom_start(bigint), public.dom_play(bigint, text, text), public.dom_draw(bigint),
  public.dom_tick(bigint), public.dom_leave(bigint)
to authenticated;
revoke execute on function public.dom_create(), public.dom_join(bigint), public.dom_add_bot(bigint),
  public.dom_start(bigint), public.dom_play(bigint, text, text), public.dom_draw(bigint),
  public.dom_tick(bigint), public.dom_leave(bigint)
from public, anon;
