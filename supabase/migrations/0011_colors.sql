-- لعبة ألوان (ورق متل أونو)
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0010)
--
-- الورق: لون (r أحمر، g أخضر، y أصفر، b أزرق) + قيمة:
--   0..9 أرقام، s منع، r عكس، d سحب ٢
--   w ألوان (بتختار اللون)، w4 ألوان سحب ٤
-- مثال: r7، gs، bd، w، w4
--
-- القواعد:
-- - كل لاعب بياخد ٧ ورقات. بتنزّل ورقة من نفس اللون أو نفس القيمة، أو ورقة ألوان.
-- - إذا ما عندك، بتسحب ورقة وبيروح الدور.
-- - منع: اللي بعدك بيروح دوره. عكس: الدور بيرجع بالعكس. +٢ و +٤: اللي بعدك بيسحب وبيروح دوره.
-- - أول واحد بيخلّص ورقه بيربح.
-- - كل دور ٢٠ ثانية، وإذا ما لعب، السيرفر بيلعب عنه.
-- ورق كل لاعب وورق الكومة سرّي بالسيرفر.

create table public.colors_games (
  id bigint generated always as identity (start with 7001) primary key,
  host uuid references public.profiles (id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  -- [{uid, pid, name, avatar, seat, bot, left, count}]
  players jsonb not null default '[]',
  turn integer,
  -- 1 مع الساعة، -1 عكسها
  direction integer not null default 1,
  top text,
  -- اللون الحالي (بيتغير مع ورقة الألوان)
  color text check (color in ('r', 'g', 'y', 'b')),
  deadline timestamptz,
  winner integer,
  last jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index colors_games_waiting_idx on public.colors_games (status, updated_at desc);
alter table public.colors_games enable row level security;
revoke all on public.colors_games from anon, authenticated;
grant select on public.colors_games to authenticated;
create policy "everyone can watch colors" on public.colors_games for select to authenticated using (true);
alter publication supabase_realtime add table public.colors_games;

-- ورق كل لاعب: كل واحد بيشوف ورقه بس
create table public.colors_hands (
  game_id bigint not null references public.colors_games (id) on delete cascade,
  seat integer not null,
  user_id uuid references public.profiles (id) on delete cascade,
  cards text[] not null default '{}',
  primary key (game_id, seat)
);
alter table public.colors_hands enable row level security;
revoke all on public.colors_hands from anon, authenticated;
grant select on public.colors_hands to authenticated;
create policy "players read their own hand" on public.colors_hands for select to authenticated
  using ((select auth.uid()) = user_id);

-- الكومة والورق المرمي: ما حدا بيقراهم
create table public.colors_piles (
  game_id bigint primary key references public.colors_games (id) on delete cascade,
  deck text[] not null,
  discard text[] not null default '{}'
);
alter table public.colors_piles enable row level security;
revoke all on public.colors_piles from anon, authenticated;

create table public.colors_results (
  game_id bigint not null references public.colors_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  won boolean not null,
  coins integer not null,
  xp integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index colors_results_user_idx on public.colors_results (user_id, created_at desc);
alter table public.colors_results enable row level security;
revoke all on public.colors_results from anon, authenticated;
grant select on public.colors_results to authenticated;
create policy "users read their colors results" on public.colors_results for select to authenticated
  using ((select auth.uid()) = user_id);

-- ===== دوال داخلية =====

-- ١٠٨ ورقة مخلوطة
create function public._colors_deck()
returns text[]
language sql
volatile
set search_path = ''
as $$
  select array_agg(c order by random()) from (
    select col || '0' as c from unnest(array['r', 'g', 'y', 'b']) col
    union all
    select col || v from unnest(array['r', 'g', 'y', 'b']) col,
      unnest(array['1', '2', '3', '4', '5', '6', '7', '8', '9', 's', 'r', 'd']) v,
      generate_series(1, 2)
    union all
    select 'w' from generate_series(1, 4)
    union all
    select 'w4' from generate_series(1, 4)
  ) x
$$;

create function public._colors_is_wild(c text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select c in ('w', 'w4') $$;

-- بتنفع هالورقة فوق اللي عالطاولة؟
create function public._colors_playable(c text, top text, color text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public._colors_is_wild(c) or left(c, 1) = color
    or (not public._colors_is_wild(top) and substr(c, 2) = substr(top, 2))
$$;

create function public._colors_is_bot(g public.colors_games, s integer)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select (p ->> 'bot')::boolean from jsonb_array_elements(g.players) p
    where (p ->> 'seat')::integer = s), false)
$$;

create function public._colors_active(g public.colors_games)
returns integer[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg((p ->> 'seat')::integer order by (p ->> 'seat')::integer), '{}')
  from jsonb_array_elements(g.players) p where not (p ->> 'left')::boolean
$$;

-- المقعد اللي بعد s بالاتجاه الحالي
create function public._colors_after(g public.colors_games, s integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select case when g.direction = 1
    then coalesce((select min(x) from unnest(public._colors_active(g)) x where x > s),
                  (select min(x) from unnest(public._colors_active(g)) x))
    else coalesce((select max(x) from unnest(public._colors_active(g)) x where x < s),
                  (select max(x) from unnest(public._colors_active(g)) x))
  end
$$;

create function public._colors_set_turn(g public.colors_games, s integer)
returns public.colors_games
language plpgsql
stable
set search_path = ''
as $$
begin
  g.turn := s;
  g.deadline := now() + case when public._colors_is_bot(g, s) then interval '1.5 seconds' else interval '20 seconds' end;
  return g;
end;
$$;

-- تحديث عدد الورق لكل لاعب (اللي بيشوفه الكل)
create function public._colors_counts(g public.colors_games)
returns public.colors_games
language plpgsql
stable
set search_path = ''
as $$
declare
  i integer;
begin
  for i in 0..jsonb_array_length(g.players) - 1 loop
    g.players := jsonb_set(g.players, array[i::text, 'count'], to_jsonb(
      (select cardinality(h.cards) from public.colors_hands h
       where h.game_id = g.id and h.seat = (g.players -> i ->> 'seat')::integer)));
  end loop;
  return g;
end;
$$;

-- سحب n ورقات لمقعد (إذا خلصت الكومة، منخلط الورق المرمي)
create function public._colors_draw(gid bigint, s integer, n integer)
returns text[]
language plpgsql
volatile
set search_path = ''
as $$
declare
  pile public.colors_piles;
  got text[] := '{}';
  k integer;
begin
  select * into pile from public.colors_piles where game_id = gid for update;
  for k in 1..n loop
    if cardinality(pile.deck) = 0 then
      exit when cardinality(pile.discard) = 0;
      select array_agg(c order by random()) into pile.deck from unnest(pile.discard) c;
      pile.discard := '{}';
    end if;
    got := got || pile.deck[1];
    pile.deck := pile.deck[2:];
  end loop;
  update public.colors_piles set deck = pile.deck, discard = pile.discard where game_id = gid;
  update public.colors_hands set cards = cards || got where game_id = gid and seat = s;
  return got;
end;
$$;

-- الجوائز: الرابح ٥٠ XP و١٠٠ عملة (إذا في لاعبين حقيقيين اتنين أو أكتر، لحد ١٠ مرات باليوم)، والباقي ١٥ XP
create function public._colors_finish(g public.colors_games)
returns void
language plpgsql
set search_path = ''
as $$
declare
  p jsonb;
  humans integer;
  is_winner boolean;
  c integer;
  today integer;
begin
  select count(*) into humans from jsonb_array_elements(g.players) q where not (q ->> 'bot')::boolean;
  for p in select * from jsonb_array_elements(g.players) loop
    continue when (p ->> 'bot')::boolean;
    is_winner := (p ->> 'seat')::integer = g.winner;
    c := 0;
    if is_winner and humans >= 2 then
      select count(*) into today from public.colors_results
      where user_id = (p ->> 'uid')::uuid and coins > 0 and created_at >= now() - interval '1 day';
      if today < 10 then c := 100; end if;
    end if;
    insert into public.colors_results (game_id, user_id, won, coins, xp)
    values (g.id, (p ->> 'uid')::uuid, is_winner, c, case when is_winner then 50 else 15 end)
    on conflict do nothing;
    if found then
      update public.profiles set xp = xp + case when is_winner then 50 else 15 end, coins = coins + c
      where id = (p ->> 'uid')::uuid;
    end if;
  end loop;
end;
$$;

-- تنزيل ورقة للي عليه الدور
create function public._colors_play(g public.colors_games, card text, pick text)
returns public.colors_games
language plpgsql
volatile
set search_path = ''
as $$
declare
  hand text[];
  idx integer;
  nxt integer;
  drawn integer := 0;
  v text;
begin
  select cards into hand from public.colors_hands where game_id = g.id and seat = g.turn;
  idx := array_position(hand, card);
  if idx is null then raise exception 'not in hand'; end if;
  if not public._colors_playable(card, g.top, g.color) then raise exception 'cannot play'; end if;
  if public._colors_is_wild(card) and (pick is null or pick not in ('r', 'g', 'y', 'b')) then
    raise exception 'pick a color';
  end if;

  hand := hand[:idx - 1] || hand[idx + 1:];
  update public.colors_hands set cards = hand where game_id = g.id and seat = g.turn;
  update public.colors_piles set discard = discard || g.top where game_id = g.id;
  g.top := card;
  g.color := case when public._colors_is_wild(card) then pick else left(card, 1) end;
  v := case when public._colors_is_wild(card) then card else substr(card, 2) end;

  if cardinality(hand) = 0 then
    g.last := jsonb_build_object('seat', g.turn, 'play', card, 'color', g.color);
    g.status := 'finished';
    g.winner := g.turn;
    g.deadline := null;
    return public._colors_counts(g);
  end if;

  if v = 'r' then
    g.direction := -g.direction;
  end if;
  nxt := public._colors_after(g, g.turn);
  if v = 'd' then
    perform public._colors_draw(g.id, nxt, 2);
    drawn := 2;
  elsif v = 'w4' then
    perform public._colors_draw(g.id, nxt, 4);
    drawn := 4;
  end if;

  g.last := jsonb_build_object('seat', g.turn, 'play', card, 'color', g.color,
    'target', nxt, 'drawn', drawn, 'uno', cardinality(hand) = 1);

  -- منع، سحب، أو عكس بلعبة لاعبين = اللي بعده بيروح دوره
  if v in ('s', 'd', 'w4') or (v = 'r' and cardinality(public._colors_active(g)) = 2) then
    nxt := public._colors_after(g, nxt);
  end if;
  return public._colors_counts(public._colors_set_turn(g, nxt));
end;
$$;

-- سحب ورقة وبيروح الدور
create function public._colors_take(g public.colors_games)
returns public.colors_games
language plpgsql
volatile
set search_path = ''
as $$
begin
  perform public._colors_draw(g.id, g.turn, 1);
  g.last := jsonb_build_object('seat', g.turn, 'draw', 1);
  return public._colors_counts(public._colors_set_turn(g, public._colors_after(g, g.turn)));
end;
$$;

-- لعب الكمبيوتر (أو اللي خلص وقته): أول ورقة بتنفع، الألوان آخر شي
create function public._colors_auto(g public.colors_games)
returns public.colors_games
language plpgsql
volatile
set search_path = ''
as $$
declare
  hand text[];
  card text;
  pick text;
begin
  select cards into hand from public.colors_hands where game_id = g.id and seat = g.turn;
  select c into card from unnest(hand) with ordinality as x(c, i)
  where public._colors_playable(c, g.top, g.color)
  order by public._colors_is_wild(c), (substr(c, 2) in ('s', 'r', 'd')) desc, i
  limit 1;
  if card is null then
    return public._colors_take(g);
  end if;
  -- اللون اللي معه أكتر شي
  select left(c, 1) into pick from unnest(hand) c
  where not public._colors_is_wild(c) group by 1 order by count(*) desc limit 1;
  return public._colors_play(g, card, coalesce(pick, 'r'));
end;
$$;

create function public._colors_save(g public.colors_games)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  g.updated_at := now();
  update public.colors_games set
    host = g.host, status = g.status, players = g.players, turn = g.turn, direction = g.direction,
    top = g.top, color = g.color, deadline = g.deadline, winner = g.winner, last = g.last,
    updated_at = g.updated_at
  where id = g.id;
  if g.status = 'finished' and g.winner is not null then
    perform public._colors_finish(g);
  end if;
  return to_jsonb(g);
end;
$$;

create function public._colors_me_json()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('uid', id, 'pid', public_id, 'name', coalesce(name, 'لاعب'),
    'avatar', avatar, 'seat', 0, 'bot', false, 'left', false, 'count', 0)
  from public.profiles where id = auth.uid()
$$;

create function public._colors_my_seat(g public.colors_games)
returns integer
language sql
stable
set search_path = ''
as $$
  select (p ->> 'seat')::integer from jsonb_array_elements(g.players) p
  where p ->> 'uid' = auth.uid()::text and not (p ->> 'left')::boolean
$$;

revoke execute on function public._colors_deck(), public._colors_is_wild(text),
  public._colors_playable(text, text, text), public._colors_is_bot(public.colors_games, integer),
  public._colors_active(public.colors_games), public._colors_after(public.colors_games, integer),
  public._colors_set_turn(public.colors_games, integer), public._colors_counts(public.colors_games),
  public._colors_draw(bigint, integer, integer), public._colors_finish(public.colors_games),
  public._colors_play(public.colors_games, text, text), public._colors_take(public.colors_games),
  public._colors_auto(public.colors_games), public._colors_save(public.colors_games),
  public._colors_me_json(), public._colors_my_seat(public.colors_games)
from public, anon, authenticated;

-- ===== اللي بيناديه التطبيق =====

create function public.colors_create()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.colors_games (host, players) values (auth.uid(), jsonb_build_array(public._colors_me_json()))
  returning id into gid;
  return gid;
end;
$$;

create function public.colors_join(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.colors_games;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from public.colors_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if exists (select 1 from jsonb_array_elements(g.players) p where p ->> 'uid' = auth.uid()::text) then
    return to_jsonb(g);
  end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) >= 4 then raise exception 'game full'; end if;
  g.players := g.players || jsonb_set(public._colors_me_json(), '{seat}', to_jsonb(jsonb_array_length(g.players)));
  return public._colors_save(g);
end;
$$;

create function public.colors_add_bot(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.colors_games;
  n integer;
begin
  select * into g from public.colors_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  n := jsonb_array_length(g.players);
  if n >= 4 then raise exception 'game full'; end if;
  g.players := g.players || jsonb_build_object('uid', null, 'pid', null,
    'name', (array['الدلّة', 'الفنجان', 'المبخرة'])[1 + (select count(*) from jsonb_array_elements(g.players) p where (p ->> 'bot')::boolean)::integer],
    'avatar', 'dalla', 'seat', n, 'bot', true, 'left', false, 'count', 0);
  return public._colors_save(g);
end;
$$;

-- البدء: خلط، توزيع ٧ ورقات، وأول ورقة رقم
create function public.colors_start(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.colors_games;
  n integer;
  deck text[];
  p jsonb;
  s integer;
  k integer;
begin
  select * into g from public.colors_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  n := jsonb_array_length(g.players);
  if n < 2 then raise exception 'need 2 players'; end if;

  deck := public._colors_deck();
  -- أول ورقة عالطاولة لازم تكون رقم
  k := (select min(i) from generate_subscripts(deck, 1) i where substr(deck[i], 2) ~ '^[0-9]$' and deck[i] not like 'w%');
  g.top := deck[k];
  deck := deck[:k - 1] || deck[k + 1:];
  g.color := left(g.top, 1);

  for p in select * from jsonb_array_elements(g.players) loop
    s := (p ->> 'seat')::integer;
    insert into public.colors_hands (game_id, seat, user_id, cards)
    values (g.id, s, (p ->> 'uid')::uuid, deck[1:7]);
    deck := deck[8:];
  end loop;
  insert into public.colors_piles (game_id, deck) values (g.id, deck);

  g.status := 'playing';
  g.direction := 1;
  g.last := null;
  g := public._colors_set_turn(g, 0);
  return public._colors_save(public._colors_counts(g));
end;
$$;

create function public.colors_play(gid bigint, card text, pick text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.colors_games;
begin
  select * into g from public.colors_games where id = gid for update;
  if not found or g.status <> 'playing' then raise exception 'not playing'; end if;
  if public._colors_my_seat(g) is distinct from g.turn then raise exception 'not your turn'; end if;
  return public._colors_save(public._colors_play(g, card, pick));
end;
$$;

create function public.colors_draw(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.colors_games;
begin
  select * into g from public.colors_games where id = gid for update;
  if not found or g.status <> 'playing' then raise exception 'not playing'; end if;
  if public._colors_my_seat(g) is distinct from g.turn then raise exception 'not your turn'; end if;
  return public._colors_save(public._colors_take(g));
end;
$$;

create function public.colors_tick(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.colors_games;
begin
  select * into g from public.colors_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if g.status <> 'playing' or g.deadline > now() then return to_jsonb(g); end if;
  return public._colors_save(public._colors_auto(g));
end;
$$;

create function public.colors_leave(gid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.colors_games;
  i integer;
  s integer;
  active integer[];
begin
  select * into g from public.colors_games where id = gid for update;
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
    perform public._colors_save(g);
    return;
  end if;

  s := (g.players -> i ->> 'seat')::integer;
  -- قبل ما نعلّمه طالع، منعرف مين بعده
  if g.turn = s then
    g := public._colors_set_turn(g, public._colors_after(g, s));
  end if;
  g.players := jsonb_set(g.players, array[i::text, 'left'], 'true');
  active := public._colors_active(g);
  if cardinality(active) = 1 then
    g.status := 'finished';
    g.winner := active[1];
    g.deadline := null;
  elsif not exists (select 1 from jsonb_array_elements(g.players) p
                    where not (p ->> 'left')::boolean and not (p ->> 'bot')::boolean) then
    g.status := 'finished';
    g.deadline := null;
  end if;
  perform public._colors_save(g);
end;
$$;

grant execute on function public.colors_create(), public.colors_join(bigint), public.colors_add_bot(bigint),
  public.colors_start(bigint), public.colors_play(bigint, text, text), public.colors_draw(bigint),
  public.colors_tick(bigint), public.colors_leave(bigint)
to authenticated;
revoke execute on function public.colors_create(), public.colors_join(bigint), public.colors_add_bot(bigint),
  public.colors_start(bigint), public.colors_play(bigint, text, text), public.colors_draw(bigint),
  public.colors_tick(bigint), public.colors_leave(bigint)
from public, anon;
