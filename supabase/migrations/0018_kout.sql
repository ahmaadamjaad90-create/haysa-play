-- كوت (بو أربعة)
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0017)
--
-- ٤ لاعبين بفريقين (المقاعد ٠ و٢ ضد ١ و٣). الورق: من ٦ لـ A بدون الستتين الحمر، وجوكرين = ٣٦ ورقة، ٩ لكل لاعب.
-- الورقة: النوع (s سبيت، h هاص، d ديمن، c شريا) + الرقم (A K Q J T 9 8 7 6)، والجوكر JR أحمر و JB أسود.
-- القوة: الجوكر الأحمر > إكة الحكم > الجوكر الأسود > باقي الحكم > نوع اللي بدأ.
-- المزايدة: من ٥ (باب) لـ ٩ (بوان) أو طاف. إذا الكل طاف، الموزّع ملزوم بـ ٥.
-- اللي بيربح المزايدة بيختار الحكم وبيبدأ. لازم تلحق النوع إذا معك (الجوكر يعتبر من الحكم).
-- ما بتبدأ بجوكر إلا إذا انلعبت A K Q J من الحكم، أو فريقك مزايد ٩ (الجوكرين) أو ٨ (الأحمر)، أو ما معك غيره.
-- النقاط: إذا جابوا المزايدة بياخدوا رقمها (البوان ٣٦). إذا ما جابوا، الخصم بياخد الضعف (الملزوم ٥ بس). أول فريق بيوصل ٣١ بيربح.

create table public.kout_games (
  id bigint generated always as identity (start with 5501) primary key,
  host uuid references public.profiles (id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  -- [{uid, pid, name, avatar, seat, bot, left, count}]
  players jsonb not null default '[]',
  scores integer[] not null default array[0, 0],
  round integer not null default 0,
  dealer integer not null default 0,
  -- bid مزايدة / trump اختيار الحكم / play لعب / roundend نتيجة الجولة
  phase text check (phase in ('bid', 'trump', 'play', 'roundend')),
  -- {seat: رقم أو 0 للطاف}
  bids jsonb not null default '{}',
  bid integer,
  bidder integer,
  malzoom boolean not null default false,
  trump text check (trump in ('s', 'h', 'd', 'c')),
  turn integer,
  -- اللمّة الحالية: [{seat, card}]
  trick jsonb not null default '[]',
  -- الورق اللي انلعب بهالجولة
  played text[] not null default '{}',
  -- أكلات كل فريق بهالجولة
  taken integer[] not null default array[0, 0],
  last_trick jsonb,
  -- نتيجة الجولة: {made, team, points}
  result jsonb,
  winner integer,
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kout_games_waiting_idx on public.kout_games (status, updated_at desc);
alter table public.kout_games enable row level security;
revoke all on public.kout_games from anon, authenticated;
grant select on public.kout_games to authenticated;
create policy "everyone can watch kout" on public.kout_games for select to authenticated using (true);
alter publication supabase_realtime add table public.kout_games;

create table public.kout_hands (
  game_id bigint not null references public.kout_games (id) on delete cascade,
  seat integer not null,
  user_id uuid references public.profiles (id) on delete cascade,
  cards text[] not null default '{}',
  primary key (game_id, seat)
);
alter table public.kout_hands enable row level security;
revoke all on public.kout_hands from anon, authenticated;
grant select on public.kout_hands to authenticated;
create policy "players read their own kout hand" on public.kout_hands for select to authenticated
  using ((select auth.uid()) = user_id);

create table public.kout_results (
  game_id bigint not null references public.kout_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  won boolean not null,
  coins integer not null,
  xp integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index kout_results_user_idx on public.kout_results (user_id, created_at desc);
alter table public.kout_results enable row level security;
revoke all on public.kout_results from anon, authenticated;
grant select on public.kout_results to authenticated;
create policy "users read their kout results" on public.kout_results for select to authenticated
  using ((select auth.uid()) = user_id);

-- ===== دوال داخلية =====

create function public._kout_rank(c text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case substr(c, 2) when 'A' then 14 when 'K' then 13 when 'Q' then 12 when 'J' then 11 when 'T' then 10
    when 'R' then 20 when 'B' then 19 else substr(c, 2)::integer end
$$;

-- نوع الورقة (الجوكر من الحكم)
create function public._kout_suit(c text, trump text)
returns text
language sql
immutable
set search_path = ''
as $$ select case when c in ('JR', 'JB') then trump else left(c, 1) end $$;

-- قوة الورقة باللمّة
create function public._kout_power(c text, trump text, led text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when c = 'JR' then 1000
    when c = trump || 'A' then 950
    when c = 'JB' then 900
    when left(c, 1) = trump then 500 + public._kout_rank(c)
    when left(c, 1) = led then 100 + public._kout_rank(c)
    else 0 end
$$;

create function public._kout_team(s integer) returns integer language sql immutable set search_path = ''
as $$ select s % 2 $$;

create function public._kout_hand(gid bigint, s integer)
returns text[]
language sql
stable
set search_path = ''
as $$ select cards from public.kout_hands where game_id = gid and seat = s $$;

create function public._kout_is_bot(g public.kout_games, s integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce((select (p ->> 'bot')::boolean or (p ->> 'left')::boolean from jsonb_array_elements(g.players) p
    where (p ->> 'seat')::integer = s), false)
$$;

create function public._kout_set_turn(g public.kout_games, s integer)
returns public.kout_games
language plpgsql
stable
set search_path = ''
as $$
begin
  g.turn := s;
  g.deadline := now() + case when public._kout_is_bot(g, s) then interval '1.2 seconds' else interval '30 seconds' end;
  return g;
end;
$$;

-- الورق اللي بيقدر ينزّله
create function public._kout_legal(g public.kout_games, s integer)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  hand text[] := public._kout_hand(g.id, s);
  led text;
  follow text[];
  honors boolean;
  team_bid integer;
begin
  if jsonb_array_length(g.trick) = 0 then
    -- البداية: الجوكر بشروط
    if not exists (select 1 from unnest(hand) c where c not in ('JR', 'JB')) then return hand; end if;
    honors := (select count(*) from unnest(g.played) c
               where c in (g.trump || 'A', g.trump || 'K', g.trump || 'Q', g.trump || 'J')) = 4;
    team_bid := case when public._kout_team(g.bidder) = public._kout_team(s) then g.bid else 0 end;
    return array(select c from unnest(hand) c
      where c not in ('JR', 'JB') or honors or team_bid = 9 or (team_bid = 8 and c = 'JR'));
  end if;
  led := public._kout_suit(g.trick -> 0 ->> 'card', g.trump);
  follow := array(select c from unnest(hand) c where public._kout_suit(c, g.trump) = led);
  if cardinality(follow) > 0 then return follow; end if;
  return hand;
end;
$$;

create function public._kout_counts(g public.kout_games)
returns public.kout_games
language plpgsql
stable
set search_path = ''
as $$
declare
  i integer;
begin
  for i in 0..jsonb_array_length(g.players) - 1 loop
    g.players := jsonb_set(g.players, array[i::text, 'count'],
      to_jsonb(coalesce(cardinality(public._kout_hand(g.id, (g.players -> i ->> 'seat')::integer)), 0)));
  end loop;
  return g;
end;
$$;

-- توزيع جولة جديدة
create function public._kout_deal(g public.kout_games)
returns public.kout_games
language plpgsql
volatile
set search_path = ''
as $$
declare
  deck text[];
  s integer;
begin
  select array_agg(c order by random()) into deck from (
    select su || r as c from unnest(array['s', 'h', 'd', 'c']) su, unnest(array['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6']) r
    where not (r = '6' and su in ('h', 'd'))
    union all select 'JR' union all select 'JB'
  ) x;
  for s in 0..3 loop
    insert into public.kout_hands (game_id, seat, user_id, cards)
    values (g.id, s, (select (p ->> 'uid')::uuid from jsonb_array_elements(g.players) p where (p ->> 'seat')::integer = s),
            deck[s * 9 + 1:s * 9 + 9])
    on conflict (game_id, seat) do update set cards = excluded.cards;
  end loop;
  g.round := g.round + 1;
  g.phase := 'bid';
  g.bids := '{}';
  g.bid := null;
  g.bidder := null;
  g.malzoom := false;
  g.trump := null;
  g.trick := '[]';
  g.played := '{}';
  g.taken := array[0, 0];
  g.last_trick := null;
  g.result := null;
  return public._kout_counts(public._kout_set_turn(g, (g.dealer + 1) % 4));
end;
$$;

-- النهاية: الفريق الرابح ٥٠ XP و١٠٠ عملة (إذا في لاعبين حقيقيين اتنين أو أكتر، لحد ١٠ باليوم)، والباقي ١٥ XP
create function public._kout_finish(g public.kout_games, team integer)
returns public.kout_games
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
  g.winner := team;
  g.deadline := null;
  select count(*) into humans from jsonb_array_elements(g.players) q where not (q ->> 'bot')::boolean;
  for p in select * from jsonb_array_elements(g.players) loop
    continue when (p ->> 'bot')::boolean;
    won := public._kout_team((p ->> 'seat')::integer) = team;
    c := 0;
    if won and humans >= 2 then
      select count(*) into today from public.kout_results
      where user_id = (p ->> 'uid')::uuid and coins > 0 and created_at >= now() - interval '1 day';
      if today < 10 then c := 100; end if;
    end if;
    insert into public.kout_results (game_id, user_id, won, coins, xp)
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

-- مزايدة (n = 0 طاف)
create function public._kout_bid(g public.kout_games, n integer)
returns public.kout_games
language plpgsql
stable
set search_path = ''
as $$
declare
  s integer := g.turn;
begin
  if n <> 0 and (n < 5 or n > 9 or n <= coalesce(g.bid, 4)) then raise exception 'bad bid'; end if;
  -- الموزّع آخر واحد: إذا الكل طاف، ملزوم
  if n = 0 and s = g.dealer and g.bid is null then raise exception 'you must bid'; end if;
  g.bids := g.bids || jsonb_build_object(s::text, n);
  if n > 0 then
    g.bid := n;
    g.bidder := s;
    g.malzoom := s = g.dealer and n = 5 and not exists (select 1 from jsonb_each(g.bids) b where (b.value)::integer > 0 and b.key::integer <> s);
  end if;
  if s = g.dealer then
    g.phase := 'trump';
    return public._kout_set_turn(g, g.bidder);
  end if;
  return public._kout_set_turn(g, (s + 1) % 4);
end;
$$;

-- آخر الجولة: النقاط، وإذا في فريق وصل ٣١ بتخلص اللعبة
create function public._kout_round_end(g public.kout_games)
returns public.kout_games
language plpgsql
set search_path = ''
as $$
declare
  t integer := public._kout_team(g.bidder);
  made boolean := g.taken[t + 1] >= g.bid;
  pts integer;
  gets integer;
begin
  if made then
    pts := case when g.bid = 9 then 36 else g.bid end;
    gets := t;
  else
    pts := case when g.malzoom then 5 else g.bid * 2 end;
    gets := 1 - t;
  end if;
  g.scores[gets + 1] := g.scores[gets + 1] + pts;
  g.result := jsonb_build_object('made', made, 'team', gets, 'points', pts, 'bid', g.bid, 'bidder', g.bidder);
  if g.scores[gets + 1] >= 31 then
    return public._kout_finish(g, gets);
  end if;
  g.phase := 'roundend';
  g.turn := null;
  g.deadline := now() + interval '6 seconds';
  return g;
end;
$$;

-- تنزيل ورقة
create function public._kout_play(g public.kout_games, card text)
returns public.kout_games
language plpgsql
set search_path = ''
as $$
declare
  led text;
  w record;
  t integer;
begin
  if not card = any (public._kout_legal(g, g.turn)) then raise exception 'illegal card'; end if;
  update public.kout_hands set cards = array_remove(cards, card) where game_id = g.id and seat = g.turn;
  g.trick := g.trick || jsonb_build_object('seat', g.turn, 'card', card);
  g.played := g.played || card;

  if jsonb_array_length(g.trick) < 4 then
    return public._kout_counts(public._kout_set_turn(g, (g.turn + 1) % 4));
  end if;

  -- مين أكل اللمّة
  led := public._kout_suit(g.trick -> 0 ->> 'card', g.trump);
  select (x ->> 'seat')::integer as seat into w from jsonb_array_elements(g.trick) x
  order by public._kout_power(x ->> 'card', g.trump, led) desc limit 1;
  t := public._kout_team(w.seat);
  g.taken[t + 1] := g.taken[t + 1] + 1;
  g.last_trick := jsonb_build_object('cards', g.trick, 'winner', w.seat);
  g.trick := '[]';
  g := public._kout_counts(g);

  -- بتخلص الجولة لما تنعرف النتيجة
  if g.taken[public._kout_team(g.bidder) + 1] >= g.bid
     or g.taken[2 - public._kout_team(g.bidder)] > 9 - g.bid then
    return public._kout_round_end(g);
  end if;
  return public._kout_set_turn(g, w.seat);
end;
$$;

-- مزايدة الكمبيوتر: تقدير الأكلات لأحسن حكم
create function public._kout_bot_bid(g public.kout_games)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  hand text[] := public._kout_hand(g.id, g.turn);
  est numeric;
  best numeric := 0;
  su text;
  n integer;
begin
  foreach su in array array['s', 'h', 'd', 'c'] loop
    select count(*) filter (where c in ('JR', 'JB'))
         + count(*) filter (where substr(c, 2) = 'A')
         + 0.5 * count(*) filter (where substr(c, 2) = 'K' and left(c, 1) = su)
         + 0.6 * greatest(0, count(*) filter (where left(c, 1) = su and substr(c, 2) not in ('A', 'K')) - 1)
    into est from unnest(hand) c;
    best := greatest(best, est);
  end loop;
  n := least(9, floor(best + 2)::integer);
  if n >= 5 and n > coalesce(g.bid, 4) then return n; end if;
  if g.turn = g.dealer and g.bid is null then return 5; end if;
  return 0;
end;
$$;

-- لعب الكمبيوتر (أو اللي خلص وقته)
create function public._kout_bot_card(g public.kout_games)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  legal text[] := public._kout_legal(g, g.turn);
  led text;
  best_seat integer;
  best_power integer;
  c text;
begin
  if jsonb_array_length(g.trick) = 0 then
    -- ببدأ بإكة مش حكم إذا معي، وإلا أصغر ورقة
    select x into c from unnest(legal) x where substr(x, 2) = 'A' and left(x, 1) <> g.trump limit 1;
    if c is not null then return c; end if;
    select x into c from unnest(legal) x order by public._kout_power(x, g.trump, left(x, 1)), random() limit 1;
    return c;
  end if;
  led := public._kout_suit(g.trick -> 0 ->> 'card', g.trump);
  select (x ->> 'seat')::integer, public._kout_power(x ->> 'card', g.trump, led) into best_seat, best_power
  from jsonb_array_elements(g.trick) x order by public._kout_power(x ->> 'card', g.trump, led) desc limit 1;
  -- شريكي ماكلها؟ بنزّل أصغر شي
  if public._kout_team(best_seat) = public._kout_team(g.turn) then
    select x into c from unnest(legal) x order by public._kout_power(x, g.trump, led), random() limit 1;
    return c;
  end if;
  -- أصغر ورقة بتغلب، وإلا أصغر ورقة
  select x into c from unnest(legal) x where public._kout_power(x, g.trump, led) > best_power
  order by public._kout_power(x, g.trump, led) limit 1;
  if c is not null then return c; end if;
  select x into c from unnest(legal) x order by public._kout_power(x, g.trump, led), random() limit 1;
  return c;
end;
$$;

create function public._kout_auto(g public.kout_games)
returns public.kout_games
language plpgsql
volatile
set search_path = ''
as $$
declare
  su text;
begin
  if g.phase = 'roundend' then
    g.dealer := (g.dealer + 1) % 4;
    return public._kout_deal(g);
  elsif g.phase = 'bid' then
    -- الإنسان اللي خلص وقته بيطوف (والموزّع ملزوم بـ ٥)
    if public._kout_is_bot(g, g.turn) then
      return public._kout_bid(g, public._kout_bot_bid(g));
    end if;
    return public._kout_bid(g, case when g.turn = g.dealer and g.bid is null then 5 else 0 end);
  elsif g.phase = 'trump' then
    select coalesce(left(c, 1), 's') into su from unnest(public._kout_hand(g.id, g.turn)) c
    where c not in ('JR', 'JB') group by 1 order by count(*) desc, max(public._kout_rank(c)) desc limit 1;
    g.trump := coalesce(su, 's');
    g.phase := 'play';
    return public._kout_set_turn(g, g.bidder);
  end if;
  return public._kout_play(g, public._kout_bot_card(g));
end;
$$;

create function public._kout_save(g public.kout_games)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  g.updated_at := now();
  update public.kout_games set
    host = g.host, status = g.status, players = g.players, scores = g.scores, round = g.round, dealer = g.dealer,
    phase = g.phase, bids = g.bids, bid = g.bid, bidder = g.bidder, malzoom = g.malzoom, trump = g.trump,
    turn = g.turn, trick = g.trick, played = g.played, taken = g.taken, last_trick = g.last_trick,
    result = g.result, winner = g.winner, deadline = g.deadline, updated_at = g.updated_at
  where id = g.id;
  return to_jsonb(g);
end;
$$;

create function public._kout_me_json()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('uid', id, 'pid', public_id, 'name', coalesce(name, 'لاعب'),
    'avatar', avatar, 'seat', 0, 'bot', false, 'left', false, 'count', 0)
  from public.profiles where id = auth.uid()
$$;

create function public._kout_my_seat(g public.kout_games)
returns integer
language sql
stable
set search_path = ''
as $$
  select (p ->> 'seat')::integer from jsonb_array_elements(g.players) p
  where p ->> 'uid' = auth.uid()::text and not (p ->> 'left')::boolean
$$;

revoke execute on function public._kout_rank(text), public._kout_suit(text, text), public._kout_power(text, text, text),
  public._kout_team(integer), public._kout_hand(bigint, integer), public._kout_is_bot(public.kout_games, integer),
  public._kout_set_turn(public.kout_games, integer), public._kout_legal(public.kout_games, integer),
  public._kout_counts(public.kout_games), public._kout_deal(public.kout_games), public._kout_finish(public.kout_games, integer),
  public._kout_bid(public.kout_games, integer), public._kout_round_end(public.kout_games), public._kout_play(public.kout_games, text),
  public._kout_bot_bid(public.kout_games), public._kout_bot_card(public.kout_games), public._kout_auto(public.kout_games),
  public._kout_save(public.kout_games), public._kout_me_json(), public._kout_my_seat(public.kout_games)
from public, anon, authenticated;

-- ===== اللي بيناديه التطبيق =====

create function public.kout_create()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.kout_games (host, players) values (auth.uid(), jsonb_build_array(public._kout_me_json()))
  returning id into gid;
  return gid;
end;
$$;

create function public.kout_join(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.kout_games;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from public.kout_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if exists (select 1 from jsonb_array_elements(g.players) p where p ->> 'uid' = auth.uid()::text) then
    return to_jsonb(g);
  end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) >= 4 then raise exception 'game full'; end if;
  g.players := g.players || jsonb_set(public._kout_me_json(), '{seat}', to_jsonb(jsonb_array_length(g.players)));
  return public._kout_save(g);
end;
$$;

create function public.kout_add_bot(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.kout_games;
  n integer;
begin
  select * into g from public.kout_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  n := jsonb_array_length(g.players);
  if n >= 4 then raise exception 'game full'; end if;
  g.players := g.players || jsonb_build_object('uid', null, 'pid', null,
    'name', (array['الدلّة', 'الفنجان', 'المبخرة'])[1 + (select count(*) from jsonb_array_elements(g.players) p where (p ->> 'bot')::boolean)::integer],
    'avatar', 'dalla', 'seat', n, 'bot', true, 'left', false, 'count', 0);
  return public._kout_save(g);
end;
$$;

create function public.kout_start(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.kout_games;
begin
  select * into g from public.kout_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) < 4 then raise exception 'need 4 players'; end if;
  g.status := 'playing';
  g.scores := array[0, 0];
  g.round := 0;
  g.dealer := floor(random() * 4)::integer;
  return public._kout_save(public._kout_deal(g));
end;
$$;

create function public.kout_bid(gid bigint, n integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.kout_games;
begin
  select * into g from public.kout_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase <> 'bid' then raise exception 'not bidding'; end if;
  if public._kout_my_seat(g) is distinct from g.turn then raise exception 'not your turn'; end if;
  return public._kout_save(public._kout_bid(g, n));
end;
$$;

create function public.kout_trump(gid bigint, suit text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.kout_games;
begin
  select * into g from public.kout_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase <> 'trump' then raise exception 'not choosing trump'; end if;
  if public._kout_my_seat(g) is distinct from g.turn then raise exception 'not your turn'; end if;
  if suit not in ('s', 'h', 'd', 'c') then raise exception 'bad suit'; end if;
  g.trump := suit;
  g.phase := 'play';
  return public._kout_save(public._kout_set_turn(g, g.bidder));
end;
$$;

create function public.kout_play(gid bigint, card text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.kout_games;
begin
  select * into g from public.kout_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase <> 'play' then raise exception 'not playing'; end if;
  if public._kout_my_seat(g) is distinct from g.turn then raise exception 'not your turn'; end if;
  return public._kout_save(public._kout_play(g, card));
end;
$$;

-- الورق اللي بقدر أنزّله هلأ (للتطبيق)
create function public.kout_legal(gid bigint)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.kout_games;
begin
  select * into g from public.kout_games where id = gid;
  if not found or g.phase <> 'play' or public._kout_my_seat(g) is distinct from g.turn then return '{}'; end if;
  return public._kout_legal(g, g.turn);
end;
$$;

create function public.kout_tick(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.kout_games;
begin
  select * into g from public.kout_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if g.status <> 'playing' or g.deadline > now() then return to_jsonb(g); end if;
  return public._kout_save(public._kout_auto(g));
end;
$$;

-- الطلوع: اللاعب بيصير كمبيوتر بيلعب عنه، وإذا ما ضل حدا حقيقي بتخلص
create function public.kout_leave(gid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.kout_games;
  i integer;
  s integer;
begin
  select * into g from public.kout_games where id = gid for update;
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
      g.host := (select (p ->> 'uid')::uuid from jsonb_array_elements(g.players) p where not (p ->> 'bot')::boolean limit 1);
    end if;
    if g.host is null then g.status := 'finished'; end if;
  else
    s := (g.players -> i ->> 'seat')::integer;
    g.players := jsonb_set(g.players, array[i::text, 'left'], 'true');
    if not exists (select 1 from jsonb_array_elements(g.players) p
                   where not (p ->> 'left')::boolean and not (p ->> 'bot')::boolean) then
      g.status := 'finished';
      g.deadline := null;
    elsif g.turn = s then
      g.deadline := now() + interval '1 second';
    end if;
  end if;
  perform public._kout_save(g);
end;
$$;

grant execute on function public.kout_create(), public.kout_join(bigint), public.kout_add_bot(bigint), public.kout_start(bigint),
  public.kout_bid(bigint, integer), public.kout_trump(bigint, text), public.kout_play(bigint, text), public.kout_legal(bigint),
  public.kout_tick(bigint), public.kout_leave(bigint)
to authenticated;
revoke execute on function public.kout_create(), public.kout_join(bigint), public.kout_add_bot(bigint), public.kout_start(bigint),
  public.kout_bid(bigint, integer), public.kout_trump(bigint, text), public.kout_play(bigint, text), public.kout_legal(bigint),
  public.kout_tick(bigint), public.kout_leave(bigint)
from public, anon;
