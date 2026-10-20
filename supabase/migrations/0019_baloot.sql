-- البلوت
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0018)
--
-- ٤ لاعبين بفريقين (٠ و٢ ضد ١ و٣)، ٣٢ ورقة (من ٧ لـ A).
-- التوزيع: ٥ لكل واحد وورقة مكشوفة. الشرا الأول: صن، حكم (بنوع المكشوفة)، أو بس.
-- الشرا التاني (إذا الكل بس): صن أو حكم بنوع تاني. إذا الكل بس كمان، بيتوزّع من جديد.
-- المشتري بياخد المكشوفة و٢، والباقي ٣ = ٨ لكل واحد.
-- الترتيب بالصن والأنواع العادية: A 10 K Q J 9 8 7. الحكم: J 9 A 10 K Q 8 7.
-- الأبناط: A=11، 10=10، K=4، Q=3، J=2. بالحكم: J=20، 9=14. آخر أكلة +10.
-- الصن مجموعه ٢٦ نقطة (الأبناط ÷ ٥)، والحكم ١٦ (الأبناط ÷ ١٠).
-- المشتري لازم ياخد أكتر من النص، وإلا الخصم بياخد كل شي.
-- المشاريع بتنحسب لحالها: سرا، خمسين، مية، أربعمية، وبلوت (الشايب والبنت من الحكم).
-- لازم تلحق النوع. بالحكم: إذا ما معك النوع ومعك حكم لازم تدق (إلا إذا شريكك ماكلها)، ولازم تعلّي الحكم إذا بتقدر.
-- أول فريق بيوصل ١٥٢ بيربح.
-- الورقة: النوع (s h d c) + الرقم (A K Q J T 9 8 7).

create table public.baloot_games (
  id bigint generated always as identity (start with 1501) primary key,
  host uuid references public.profiles (id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  -- [{uid, pid, name, avatar, seat, bot, left, count}]
  players jsonb not null default '[]',
  scores integer[] not null default array[0, 0],
  round integer not null default 0,
  dealer integer not null default 0,
  -- bid1 / bid2 / play / roundend
  phase text check (phase in ('bid1', 'bid2', 'play', 'roundend')),
  -- الورقة المكشوفة
  face text,
  -- {seat: sun / hokm / hokm:s / pass}
  bids jsonb not null default '{}',
  -- sun أو hokm
  kind text check (kind in ('sun', 'hokm')),
  buyer integer,
  trump text check (trump in ('s', 'h', 'd', 'c')),
  turn integer,
  trick jsonb not null default '[]',
  -- أبناط كل فريق بهالجولة
  abnat integer[] not null default array[0, 0],
  tricks integer not null default 0,
  last_trick jsonb,
  -- المشاريع: [{seat, name, points}]
  projects jsonb not null default '[]',
  result jsonb,
  winner integer,
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index baloot_games_waiting_idx on public.baloot_games (status, updated_at desc);
alter table public.baloot_games enable row level security;
revoke all on public.baloot_games from anon, authenticated;
grant select on public.baloot_games to authenticated;
create policy "everyone can watch baloot" on public.baloot_games for select to authenticated using (true);
alter publication supabase_realtime add table public.baloot_games;

create table public.baloot_hands (
  game_id bigint not null references public.baloot_games (id) on delete cascade,
  seat integer not null,
  user_id uuid references public.profiles (id) on delete cascade,
  cards text[] not null default '{}',
  primary key (game_id, seat)
);
alter table public.baloot_hands enable row level security;
revoke all on public.baloot_hands from anon, authenticated;
grant select on public.baloot_hands to authenticated;
create policy "players read their own baloot hand" on public.baloot_hands for select to authenticated
  using ((select auth.uid()) = user_id);

-- باقي الكومة (مخبّاية)
create table public.baloot_decks (
  game_id bigint primary key references public.baloot_games (id) on delete cascade,
  cards text[] not null
);
alter table public.baloot_decks enable row level security;
revoke all on public.baloot_decks from anon, authenticated;

create table public.baloot_results (
  game_id bigint not null references public.baloot_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  won boolean not null,
  coins integer not null,
  xp integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index baloot_results_user_idx on public.baloot_results (user_id, created_at desc);
alter table public.baloot_results enable row level security;
revoke all on public.baloot_results from anon, authenticated;
grant select on public.baloot_results to authenticated;
create policy "users read their baloot results" on public.baloot_results for select to authenticated
  using ((select auth.uid()) = user_id);

-- ===== دوال الورق =====

-- قوة الورقة جوا نوعها (أكبر = أقوى)
create function public._bl_order(c text, is_trump boolean)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when is_trump then
    case substr(c, 2) when 'J' then 8 when '9' then 7 when 'A' then 6 when 'T' then 5 when 'K' then 4 when 'Q' then 3 when '8' then 2 else 1 end
  else
    case substr(c, 2) when 'A' then 8 when 'T' then 7 when 'K' then 6 when 'Q' then 5 when 'J' then 4 when '9' then 3 when '8' then 2 else 1 end
  end
$$;

-- أبناط الورقة
create function public._bl_points(c text, is_trump boolean)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case substr(c, 2)
    when 'A' then 11 when 'T' then 10 when 'K' then 4 when 'Q' then 3
    when 'J' then case when is_trump then 20 else 2 end
    when '9' then case when is_trump then 14 else 0 end
    else 0 end
$$;

-- قوة الورقة باللمّة
create function public._bl_power(c text, trump text, led text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when trump is not null and left(c, 1) = trump then 100 + public._bl_order(c, true)
    when left(c, 1) = led then 10 + public._bl_order(c, false)
    else 0 end
$$;

create function public._bl_team(s integer) returns integer language sql immutable set search_path = ''
as $$ select s % 2 $$;

create function public._bl_hand(gid bigint, s integer)
returns text[]
language sql
stable
set search_path = ''
as $$ select cards from public.baloot_hands where game_id = gid and seat = s $$;

create function public._bl_is_bot(g public.baloot_games, s integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce((select (p ->> 'bot')::boolean or (p ->> 'left')::boolean from jsonb_array_elements(g.players) p
    where (p ->> 'seat')::integer = s), false)
$$;

create function public._bl_set_turn(g public.baloot_games, s integer)
returns public.baloot_games
language plpgsql
stable
set search_path = ''
as $$
begin
  g.turn := s;
  g.deadline := now() + case when public._bl_is_bot(g, s) then interval '1.2 seconds' else interval '30 seconds' end;
  return g;
end;
$$;

create function public._bl_counts(g public.baloot_games)
returns public.baloot_games
language plpgsql
stable
set search_path = ''
as $$
declare
  i integer;
begin
  for i in 0..jsonb_array_length(g.players) - 1 loop
    g.players := jsonb_set(g.players, array[i::text, 'count'],
      to_jsonb(coalesce(cardinality(public._bl_hand(g.id, (g.players -> i ->> 'seat')::integer)), 0)));
  end loop;
  return g;
end;
$$;

-- الورق المسموح
create function public._bl_legal(g public.baloot_games, s integer)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  hand text[] := public._bl_hand(g.id, s);
  led text;
  follow text[];
  trumps text[];
  best_seat integer;
  best_power integer;
  higher text[];
begin
  if jsonb_array_length(g.trick) = 0 then return hand; end if;
  led := left(g.trick -> 0 ->> 'card', 1);
  select (x ->> 'seat')::integer, public._bl_power(x ->> 'card', g.trump, led) into best_seat, best_power
  from jsonb_array_elements(g.trick) x order by public._bl_power(x ->> 'card', g.trump, led) desc limit 1;

  follow := array(select c from unnest(hand) c where left(c, 1) = led);
  if cardinality(follow) > 0 then
    -- إذا النوع حكم، لازم تعلّي إذا بتقدر
    if g.kind = 'hokm' and led = g.trump then
      higher := array(select c from unnest(follow) c where public._bl_power(c, g.trump, led) > best_power);
      if cardinality(higher) > 0 then return higher; end if;
    end if;
    return follow;
  end if;
  if g.kind = 'hokm' then
    trumps := array(select c from unnest(hand) c where left(c, 1) = g.trump);
    -- شريكي ماكلها؟ مش لازم أدق
    if cardinality(trumps) > 0 and public._bl_team(best_seat) <> public._bl_team(s) then
      higher := array(select c from unnest(trumps) c where public._bl_power(c, g.trump, led) > best_power);
      if cardinality(higher) > 0 then return higher; end if;
      return trumps;
    end if;
  end if;
  return hand;
end;
$$;

-- المشاريع من ورق كل لاعب (بعد التوزيع الكامل)
create function public._bl_projects(g public.baloot_games)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  s integer;
  hand text[];
  su text;
  run integer;
  best integer;
  r text;
  out jsonb := '[]';
  seq text[] := array['A', 'K', 'Q', 'J', 'T', '9', '8', '7'];
  i integer;
  sun boolean := g.kind = 'sun';
begin
  for s in 0..3 loop
    hand := public._bl_hand(g.id, s);
    -- سلاسل بنفس النوع
    foreach su in array array['s', 'h', 'd', 'c'] loop
      run := 0;
      for i in 1..8 loop
        if su || seq[i] = any (hand) then
          run := run + 1;
        else
          if run >= 3 then
            out := out || jsonb_build_object('seat', s,
              'name', case when run >= 5 then 'مية' when run = 4 then 'خمسين' else 'سرا' end,
              'points', case when run >= 5 then (case when sun then 20 else 10 end)
                             when run = 4 then (case when sun then 10 else 5 end) else (case when sun then 4 else 2 end) end);
          end if;
          run := 0;
        end if;
      end loop;
      if run >= 3 then
        out := out || jsonb_build_object('seat', s,
          'name', case when run >= 5 then 'مية' when run = 4 then 'خمسين' else 'سرا' end,
          'points', case when run >= 5 then (case when sun then 20 else 10 end)
                         when run = 4 then (case when sun then 10 else 5 end) else (case when sun then 4 else 2 end) end);
      end if;
    end loop;
    -- أربعة من نفس الرقم
    foreach r in array array['A', 'K', 'Q', 'J', 'T'] loop
      if (select count(*) from unnest(hand) c where substr(c, 2) = r) = 4 then
        out := out || jsonb_build_object('seat', s,
          'name', case when r = 'A' and sun then 'أربعمية' else 'مية' end,
          'points', case when r = 'A' and sun then 40 when sun then 20 else 10 end);
      end if;
    end loop;
    -- بلوت: الشايب والبنت من الحكم
    if not sun and g.trump || 'K' = any (hand) and g.trump || 'Q' = any (hand) then
      out := out || jsonb_build_object('seat', s, 'name', 'بلوت', 'points', 2, 'baloot', true);
    end if;
  end loop;
  return out;
end;
$$;

-- النهاية: الفريق الرابح ٥٠ XP و١٠٠ عملة (إذا في لاعبين حقيقيين اتنين أو أكتر، لحد ١٠ باليوم)، والباقي ١٥ XP
create function public._bl_finish(g public.baloot_games, team integer)
returns public.baloot_games
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
    won := public._bl_team((p ->> 'seat')::integer) = team;
    c := 0;
    if won and humans >= 2 then
      select count(*) into today from public.baloot_results
      where user_id = (p ->> 'uid')::uuid and coins > 0 and created_at >= now() - interval '1 day';
      if today < 10 then c := 100; end if;
    end if;
    insert into public.baloot_results (game_id, user_id, won, coins, xp)
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

-- توزيع: ٥ لكل واحد وورقة مكشوفة
create function public._bl_deal(g public.baloot_games)
returns public.baloot_games
language plpgsql
volatile
set search_path = ''
as $$
declare
  deck text[];
  s integer;
begin
  select array_agg(su || r order by random()) into deck
  from unnest(array['s', 'h', 'd', 'c']) su, unnest(array['A', 'K', 'Q', 'J', 'T', '9', '8', '7']) r;
  for s in 0..3 loop
    insert into public.baloot_hands (game_id, seat, user_id, cards)
    values (g.id, s, (select (p ->> 'uid')::uuid from jsonb_array_elements(g.players) p where (p ->> 'seat')::integer = s),
            deck[s * 5 + 1:s * 5 + 5])
    on conflict (game_id, seat) do update set cards = excluded.cards;
  end loop;
  g.face := deck[21];
  insert into public.baloot_decks (game_id, cards) values (g.id, deck[22:32])
  on conflict (game_id) do update set cards = excluded.cards;
  g.round := g.round + 1;
  g.phase := 'bid1';
  g.bids := '{}';
  g.kind := null;
  g.buyer := null;
  g.trump := null;
  g.trick := '[]';
  g.abnat := array[0, 0];
  g.tricks := 0;
  g.last_trick := null;
  g.projects := '[]';
  g.result := null;
  return public._bl_counts(public._bl_set_turn(g, (g.dealer + 1) % 4));
end;
$$;

-- تكملة التوزيع للمشتري والباقي، وبداية اللعب
create function public._bl_complete(g public.baloot_games)
returns public.baloot_games
language plpgsql
set search_path = ''
as $$
declare
  rest text[];
  s integer;
  k integer := 1;
begin
  select cards into rest from public.baloot_decks where game_id = g.id;
  for s in 0..3 loop
    if s = g.buyer then
      update public.baloot_hands set cards = cards || g.face || rest[k:k + 1] where game_id = g.id and seat = s;
      k := k + 2;
    else
      update public.baloot_hands set cards = cards || rest[k:k + 2] where game_id = g.id and seat = s;
      k := k + 3;
    end if;
  end loop;
  update public.baloot_decks set cards = '{}' where game_id = g.id;
  g.phase := 'play';
  g.projects := public._bl_projects(g);
  return public._bl_counts(public._bl_set_turn(g, (g.dealer + 1) % 4));
end;
$$;

-- الشرا: sun / hokm / hokm:x / pass
create function public._bl_bid(g public.baloot_games, b text)
returns public.baloot_games
language plpgsql
set search_path = ''
as $$
declare
  s integer := g.turn;
  su text;
  last_seat integer := g.dealer;
begin
  if g.phase = 'bid1' and b not in ('sun', 'hokm', 'pass') then raise exception 'bad bid'; end if;
  if g.phase = 'bid2' then
    if b = 'hokm' then raise exception 'pick a suit'; end if;
    if b like 'hokm:%' then
      su := substr(b, 6);
      if su not in ('s', 'h', 'd', 'c') or su = left(g.face, 1) then raise exception 'bad suit'; end if;
    elsif b not in ('sun', 'pass') then
      raise exception 'bad bid';
    end if;
  end if;
  g.bids := g.bids || jsonb_build_object(s::text, b);

  -- الصن أقوى شي: بيخلص الشرا فوراً
  if b = 'sun' then
    g.kind := 'sun';
    g.buyer := s;
    g.trump := null;
    return public._bl_complete(g);
  end if;
  if b like 'hokm%' and g.kind is null then
    g.kind := 'hokm';
    g.buyer := s;
    g.trump := case when b = 'hokm' then left(g.face, 1) else substr(b, 6) end;
  end if;

  if s = last_seat then
    if g.kind is not null then
      return public._bl_complete(g);
    end if;
    if g.phase = 'bid1' then
      g.phase := 'bid2';
      g.bids := '{}';
      return public._bl_set_turn(g, (g.dealer + 1) % 4);
    end if;
    -- الكل بس مرتين: توزيع جديد
    g.dealer := (g.dealer + 1) % 4;
    g := public._bl_deal(g);
    g.round := g.round - 1;
    return g;
  end if;
  return public._bl_set_turn(g, (s + 1) % 4);
end;
$$;

-- آخر الجولة: الأبناط لنقاط، والمشاريع، وإذا ما جاب المشتري النص الخصم بياخد كل شي
create function public._bl_round_end(g public.baloot_games)
returns public.baloot_games
language plpgsql
set search_path = ''
as $$
declare
  bt integer := public._bl_team(g.buyer);
  total_abnat integer := case when g.kind = 'sun' then 130 else 162 end;
  total_pts integer := case when g.kind = 'sun' then 26 else 16 end;
  made boolean := g.abnat[bt + 1] * 2 > total_abnat;
  card_pts integer[] := array[0, 0];
  proj integer[] := array[0, 0];
  best integer[] := array[0, 0];
  win_proj integer;
  p jsonb;
  t integer;
  gain integer[];
begin
  -- نقاط الورق
  card_pts[bt + 1] := round(g.abnat[bt + 1]::numeric * total_pts / total_abnat);
  card_pts[2 - bt] := total_pts - card_pts[bt + 1];

  -- المشاريع: الفريق اللي عنده أكبر مشروع بياخد مشاريعه (البلوت دايماً لصاحبه)
  for p in select * from jsonb_array_elements(g.projects) where not coalesce((value ->> 'baloot')::boolean, false) loop
    t := public._bl_team((p ->> 'seat')::integer);
    best[t + 1] := greatest(best[t + 1], (p ->> 'points')::integer);
  end loop;
  win_proj := case when best[1] = 0 and best[2] = 0 then null
                   when best[1] > best[2] then 0 when best[2] > best[1] then 1 else bt end;
  for p in select * from jsonb_array_elements(g.projects) loop
    t := public._bl_team((p ->> 'seat')::integer);
    if coalesce((p ->> 'baloot')::boolean, false) or t = win_proj then
      proj[t + 1] := proj[t + 1] + (p ->> 'points')::integer;
    end if;
  end loop;

  if made then
    gain := array[card_pts[1] + proj[1], card_pts[2] + proj[2]];
  else
    -- الخصم بياخد كل شي (إلا البلوت بيضل لصاحبه)
    gain := array[0, 0];
    gain[2 - bt] := total_pts + proj[1] + proj[2];
    for p in select * from jsonb_array_elements(g.projects) where coalesce((value ->> 'baloot')::boolean, false) loop
      t := public._bl_team((p ->> 'seat')::integer);
      if t = bt then
        gain[2 - bt] := gain[2 - bt] - 2;
        gain[bt + 1] := gain[bt + 1] + 2;
      end if;
    end loop;
  end if;

  g.scores := array[g.scores[1] + gain[1], g.scores[2] + gain[2]];
  g.result := jsonb_build_object('made', made, 'buyer', g.buyer, 'kind', g.kind, 'abnat', to_jsonb(g.abnat),
    'gain', to_jsonb(gain), 'projects', to_jsonb(proj));

  if greatest(g.scores[1], g.scores[2]) >= 152 and g.scores[1] <> g.scores[2] then
    return public._bl_finish(g, case when g.scores[1] > g.scores[2] then 0 else 1 end);
  end if;
  g.phase := 'roundend';
  g.turn := null;
  g.deadline := now() + interval '7 seconds';
  return g;
end;
$$;

create function public._bl_play(g public.baloot_games, card text)
returns public.baloot_games
language plpgsql
set search_path = ''
as $$
declare
  led text;
  w integer;
  t integer;
  pts integer;
begin
  if not card = any (public._bl_legal(g, g.turn)) then raise exception 'illegal card'; end if;
  update public.baloot_hands set cards = array_remove(cards, card) where game_id = g.id and seat = g.turn;
  g.trick := g.trick || jsonb_build_object('seat', g.turn, 'card', card);

  if jsonb_array_length(g.trick) < 4 then
    return public._bl_counts(public._bl_set_turn(g, (g.turn + 1) % 4));
  end if;

  led := left(g.trick -> 0 ->> 'card', 1);
  select (x ->> 'seat')::integer into w from jsonb_array_elements(g.trick) x
  order by public._bl_power(x ->> 'card', g.trump, led) desc limit 1;
  select coalesce(sum(public._bl_points(x ->> 'card', g.trump is not null and left(x ->> 'card', 1) = g.trump)), 0)
  into pts from jsonb_array_elements(g.trick) x;
  g.tricks := g.tricks + 1;
  if g.tricks = 8 then pts := pts + 10; end if;
  t := public._bl_team(w);
  g.abnat[t + 1] := g.abnat[t + 1] + pts;
  g.last_trick := jsonb_build_object('cards', g.trick, 'winner', w);
  g.trick := '[]';
  g := public._bl_counts(g);

  if g.tricks = 8 then
    return public._bl_round_end(g);
  end if;
  return public._bl_set_turn(g, w);
end;
$$;

-- شرا الكمبيوتر
create function public._bl_bot_bid(g public.baloot_games)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  hand text[] := public._bl_hand(g.id, g.turn) || g.face;
  aces integer;
  tens integer;
  su text;
  score integer;
  best text;
  best_score integer := 0;
begin
  select count(*) filter (where substr(c, 2) = 'A'), count(*) filter (where substr(c, 2) = 'T') into aces, tens from unnest(hand) c;
  if aces >= 3 or (aces = 2 and tens >= 2) then return 'sun'; end if;
  foreach su in array array['s', 'h', 'd', 'c'] loop
    continue when g.phase = 'bid1' and su <> left(g.face, 1);
    continue when g.phase = 'bid2' and su = left(g.face, 1);
    select coalesce(sum(case substr(c, 2) when 'J' then 4 when '9' then 3 when 'A' then 2 else 1 end), 0) into score
    from unnest(hand) c where left(c, 1) = su;
    if score > best_score then best := su; best_score := score; end if;
  end loop;
  if best_score >= 7 then
    return case when g.phase = 'bid1' then 'hokm' else 'hokm:' || best end;
  end if;
  return 'pass';
end;
$$;

-- لعب الكمبيوتر (أو اللي خلص وقته)
create function public._bl_bot_card(g public.baloot_games)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  legal text[] := public._bl_legal(g, g.turn);
  led text;
  best_seat integer;
  best_power integer;
  c text;
begin
  if jsonb_array_length(g.trick) = 0 then
    select x into c from unnest(legal) x where substr(x, 2) = 'A' and left(x, 1) is distinct from g.trump limit 1;
    if c is not null then return c; end if;
    select x into c from unnest(legal) x order by public._bl_power(x, g.trump, left(x, 1)), random() limit 1;
    return c;
  end if;
  led := left(g.trick -> 0 ->> 'card', 1);
  select (x ->> 'seat')::integer, public._bl_power(x ->> 'card', g.trump, led) into best_seat, best_power
  from jsonb_array_elements(g.trick) x order by public._bl_power(x ->> 'card', g.trump, led) desc limit 1;
  if public._bl_team(best_seat) = public._bl_team(g.turn) then
    -- شريكي ماكلها: بعطيه أبناط إذا بقدر
    select x into c from unnest(legal) x where public._bl_power(x, g.trump, led) < best_power
    order by public._bl_points(x, left(x, 1) = g.trump) desc limit 1;
    if c is not null then return c; end if;
  else
    select x into c from unnest(legal) x where public._bl_power(x, g.trump, led) > best_power
    order by public._bl_power(x, g.trump, led) limit 1;
    if c is not null then return c; end if;
  end if;
  select x into c from unnest(legal) x
  order by public._bl_points(x, left(x, 1) = g.trump), public._bl_power(x, g.trump, led), random() limit 1;
  return c;
end;
$$;

create function public._bl_auto(g public.baloot_games)
returns public.baloot_games
language plpgsql
volatile
set search_path = ''
as $$
begin
  if g.phase = 'roundend' then
    g.dealer := (g.dealer + 1) % 4;
    return public._bl_deal(g);
  elsif g.phase in ('bid1', 'bid2') then
    if public._bl_is_bot(g, g.turn) then
      return public._bl_bid(g, public._bl_bot_bid(g));
    end if;
    return public._bl_bid(g, 'pass');
  end if;
  return public._bl_play(g, public._bl_bot_card(g));
end;
$$;

create function public._bl_save(g public.baloot_games)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  g.updated_at := now();
  update public.baloot_games set
    host = g.host, status = g.status, players = g.players, scores = g.scores, round = g.round, dealer = g.dealer,
    phase = g.phase, face = g.face, bids = g.bids, kind = g.kind, buyer = g.buyer, trump = g.trump, turn = g.turn,
    trick = g.trick, abnat = g.abnat, tricks = g.tricks, last_trick = g.last_trick, projects = g.projects,
    result = g.result, winner = g.winner, deadline = g.deadline, updated_at = g.updated_at
  where id = g.id;
  return to_jsonb(g);
end;
$$;

create function public._bl_me_json()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('uid', id, 'pid', public_id, 'name', coalesce(name, 'لاعب'),
    'avatar', avatar, 'seat', 0, 'bot', false, 'left', false, 'count', 0)
  from public.profiles where id = auth.uid()
$$;

create function public._bl_my_seat(g public.baloot_games)
returns integer
language sql
stable
set search_path = ''
as $$
  select (p ->> 'seat')::integer from jsonb_array_elements(g.players) p
  where p ->> 'uid' = auth.uid()::text and not (p ->> 'left')::boolean
$$;

revoke execute on function public._bl_order(text, boolean), public._bl_points(text, boolean), public._bl_power(text, text, text),
  public._bl_team(integer), public._bl_hand(bigint, integer), public._bl_is_bot(public.baloot_games, integer),
  public._bl_set_turn(public.baloot_games, integer), public._bl_counts(public.baloot_games),
  public._bl_legal(public.baloot_games, integer), public._bl_projects(public.baloot_games),
  public._bl_finish(public.baloot_games, integer), public._bl_deal(public.baloot_games), public._bl_complete(public.baloot_games),
  public._bl_bid(public.baloot_games, text), public._bl_round_end(public.baloot_games), public._bl_play(public.baloot_games, text),
  public._bl_bot_bid(public.baloot_games), public._bl_bot_card(public.baloot_games), public._bl_auto(public.baloot_games),
  public._bl_save(public.baloot_games), public._bl_me_json(), public._bl_my_seat(public.baloot_games)
from public, anon, authenticated;

-- ===== اللي بيناديه التطبيق =====

create function public.baloot_create()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.baloot_games (host, players) values (auth.uid(), jsonb_build_array(public._bl_me_json()))
  returning id into gid;
  return gid;
end;
$$;

create function public.baloot_join(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.baloot_games;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from public.baloot_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if exists (select 1 from jsonb_array_elements(g.players) p where p ->> 'uid' = auth.uid()::text) then
    return to_jsonb(g);
  end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) >= 4 then raise exception 'game full'; end if;
  g.players := g.players || jsonb_set(public._bl_me_json(), '{seat}', to_jsonb(jsonb_array_length(g.players)));
  return public._bl_save(g);
end;
$$;

create function public.baloot_add_bot(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.baloot_games;
  n integer;
begin
  select * into g from public.baloot_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  n := jsonb_array_length(g.players);
  if n >= 4 then raise exception 'game full'; end if;
  g.players := g.players || jsonb_build_object('uid', null, 'pid', null,
    'name', (array['الدلّة', 'الفنجان', 'المبخرة'])[1 + (select count(*) from jsonb_array_elements(g.players) p where (p ->> 'bot')::boolean)::integer],
    'avatar', 'dalla', 'seat', n, 'bot', true, 'left', false, 'count', 0);
  return public._bl_save(g);
end;
$$;

create function public.baloot_start(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.baloot_games;
begin
  select * into g from public.baloot_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) < 4 then raise exception 'need 4 players'; end if;
  g.status := 'playing';
  g.scores := array[0, 0];
  g.round := 0;
  g.dealer := floor(random() * 4)::integer;
  return public._bl_save(public._bl_deal(g));
end;
$$;

create function public.baloot_bid(gid bigint, b text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.baloot_games;
begin
  select * into g from public.baloot_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase not in ('bid1', 'bid2') then raise exception 'not bidding'; end if;
  if public._bl_my_seat(g) is distinct from g.turn then raise exception 'not your turn'; end if;
  return public._bl_save(public._bl_bid(g, b));
end;
$$;

create function public.baloot_play(gid bigint, card text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.baloot_games;
begin
  select * into g from public.baloot_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase <> 'play' then raise exception 'not playing'; end if;
  if public._bl_my_seat(g) is distinct from g.turn then raise exception 'not your turn'; end if;
  return public._bl_save(public._bl_play(g, card));
end;
$$;

create function public.baloot_legal(gid bigint)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.baloot_games;
begin
  select * into g from public.baloot_games where id = gid;
  if not found or g.phase <> 'play' or public._bl_my_seat(g) is distinct from g.turn then return '{}'; end if;
  return public._bl_legal(g, g.turn);
end;
$$;

create function public.baloot_tick(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.baloot_games;
begin
  select * into g from public.baloot_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if g.status <> 'playing' or g.deadline > now() then return to_jsonb(g); end if;
  return public._bl_save(public._bl_auto(g));
end;
$$;

create function public.baloot_leave(gid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.baloot_games;
  i integer;
  s integer;
begin
  select * into g from public.baloot_games where id = gid for update;
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
  perform public._bl_save(g);
end;
$$;

grant execute on function public.baloot_create(), public.baloot_join(bigint), public.baloot_add_bot(bigint),
  public.baloot_start(bigint), public.baloot_bid(bigint, text), public.baloot_play(bigint, text),
  public.baloot_legal(bigint), public.baloot_tick(bigint), public.baloot_leave(bigint)
to authenticated;
revoke execute on function public.baloot_create(), public.baloot_join(bigint), public.baloot_add_bot(bigint),
  public.baloot_start(bigint), public.baloot_bid(bigint, text), public.baloot_play(bigint, text),
  public.baloot_legal(bigint), public.baloot_tick(bigint), public.baloot_leave(bigint)
from public, anon;
