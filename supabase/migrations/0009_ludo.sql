-- لعبة لودو
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0008)
--
-- كل اللعب بالسيرفر: الزهر بينرمي هون، والحركات بتنفحص هون، فما حدا بيقدر يغش.
-- التطبيق بس بيبعت "ارمِ" و "حرّك الحجر رقم كذا"، وبيستقبل الطاولة الجديدة لحظياً.
--
-- القواعد:
-- - كل لاعب عنده ٤ أحجار. بتطلع من البيت بـ ٦ بس.
-- - الطريق ٥٢ مربع، بعده ٥ مربعات ملونة، وبعدها الوسط (٥٦).
-- - ٦ أو أكل حجر أو وصول حجر للوسط = دور زيادة. تلات ستات ورا بعض = بيروح الدور.
-- - مربعات البداية والنجوم آمنة (ما في أكل).
-- - لازم الرقم يكون بالضبط عشان توصل للوسط.
-- - أول واحد بيوصّل أحجاره الأربعة بيربح.
-- - كل دور ٢٠ ثانية، وإذا ما لعب، السيرفر بيلعب عنه.

-- مكان الحجر (tokens[seat*4 + i + 1]):
--   -1 = بالبيت، 0..50 = عالطريق (من بداية لونه)، 51..55 = الممر الملون، 56 = وصل

create table public.ludo_games (
  id bigint generated always as identity (start with 1001) primary key,
  host uuid references public.profiles (id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  -- [{uid, pid, name, avatar, seat, bot, left}]
  players jsonb not null default '[]',
  tokens integer[] not null default array_fill(-1, array[16]),
  turn integer,
  phase text check (phase in ('roll', 'move')),
  dice integer,
  sixes integer not null default 0,
  deadline timestamptz,
  winner integer,
  -- آخر حركة، عشان التطبيق يعرضها
  last jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ludo_games_waiting_idx on public.ludo_games (status, updated_at desc);

alter table public.ludo_games enable row level security;
revoke all on public.ludo_games from anon, authenticated;
grant select on public.ludo_games to authenticated;
create policy "everyone can watch ludo" on public.ludo_games for select to authenticated using (true);

alter publication supabase_realtime add table public.ludo_games;

-- نتايج كل لعبة (للجوائز وحدّها اليومي)
create table public.ludo_results (
  game_id bigint not null references public.ludo_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  won boolean not null,
  coins integer not null,
  xp integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index ludo_results_user_idx on public.ludo_results (user_id, created_at desc);
alter table public.ludo_results enable row level security;
revoke all on public.ludo_results from anon, authenticated;
grant select on public.ludo_results to authenticated;
create policy "users read their ludo results" on public.ludo_results for select to authenticated
  using ((select auth.uid()) = user_id);

-- ===== دوال داخلية (ما بتنادى من التطبيق) =====

-- رقم المربع عالطريق المشترك (0..51)
create function public._ludo_abs(seat integer, rel integer)
returns integer
language sql
immutable
set search_path = ''
as $$ select (seat * 13 + rel) % 52 $$;

create function public._ludo_safe(sq integer)
returns boolean
language sql
immutable
set search_path = ''
as $$ select sq in (0, 8, 13, 21, 26, 34, 39, 47) $$;

create function public._ludo_is_bot(g public.ludo_games, s integer)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select (p ->> 'bot')::boolean from jsonb_array_elements(g.players) p
    where (p ->> 'seat')::integer = s), false)
$$;

-- المقاعد اللي لسا بتلعب، بالترتيب
create function public._ludo_active(g public.ludo_games)
returns integer[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg((p ->> 'seat')::integer order by (p ->> 'seat')::integer), '{}')
  from jsonb_array_elements(g.players) p
  where not (p ->> 'left')::boolean
$$;

create function public._ludo_deadline(g public.ludo_games)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now() + case when public._ludo_is_bot(g, g.turn) then interval '1.2 seconds' else interval '20 seconds' end
$$;

-- الدور للي بعده
create function public._ludo_next(g public.ludo_games)
returns public.ludo_games
language plpgsql
stable
set search_path = ''
as $$
declare
  seats integer[] := public._ludo_active(g);
  s integer;
begin
  g.turn := coalesce((select min(x) from unnest(seats) x where x > g.turn), seats[1]);
  g.phase := 'roll';
  g.sixes := 0;
  g.deadline := public._ludo_deadline(g);
  return g;
end;
$$;

-- الأحجار اللي بتقدر تتحرك بهالرقم
create function public._ludo_legal(g public.ludo_games)
returns integer[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(t order by t), '{}')
  from generate_series(0, 3) t
  where (g.tokens[g.turn * 4 + t + 1] = -1 and g.dice = 6)
     or (g.tokens[g.turn * 4 + t + 1] between 0 and 55 and g.tokens[g.turn * 4 + t + 1] + g.dice <= 56)
$$;

-- الجوائز آخر اللعبة: الرابح ٥٠ XP و١٠٠ عملة (إذا في لاعبين حقيقيين اتنين أو أكتر،
-- ولحد ١٠ مرات باليوم)، والباقي ١٥ XP
create function public._ludo_finish(g public.ludo_games)
returns void
language plpgsql
set search_path = ''
as $$
declare
  p jsonb;
  humans integer;
  is_winner boolean;
  c integer;
  x integer;
  today integer;
begin
  select count(*) into humans from jsonb_array_elements(g.players) q where not (q ->> 'bot')::boolean;
  for p in select * from jsonb_array_elements(g.players) loop
    continue when (p ->> 'bot')::boolean;
    is_winner := (p ->> 'seat')::integer = g.winner;
    x := case when is_winner then 50 else 15 end;
    c := 0;
    if is_winner and humans >= 2 then
      select count(*) into today from public.ludo_results
      where user_id = (p ->> 'uid')::uuid and coins > 0 and created_at >= now() - interval '1 day';
      if today < 10 then c := 100; end if;
    end if;
    insert into public.ludo_results (game_id, user_id, won, coins, xp)
    values (g.id, (p ->> 'uid')::uuid, is_winner, c, x)
    on conflict do nothing;
    if found then
      update public.profiles set xp = xp + x, coins = coins + c where id = (p ->> 'uid')::uuid;
    end if;
  end loop;
end;
$$;

-- تحريك حجر للي عليه الدور
create function public._ludo_move(g public.ludo_games, t integer)
returns public.ludo_games
language plpgsql
set search_path = ''
as $$
declare
  idx integer := g.turn * 4 + t + 1;
  r integer := g.tokens[idx];
  nr integer;
  sq integer;
  captured jsonb := '[]';
  s integer;
  k integer;
  rr integer;
begin
  nr := case when r = -1 then 0 else r + g.dice end;
  g.tokens[idx] := nr;

  -- أكل أحجار الخصم إذا مش مربع آمن
  if nr <= 50 then
    sq := public._ludo_abs(g.turn, nr);
    if not public._ludo_safe(sq) then
      for s in 0..3 loop
        continue when s = g.turn;
        for k in 0..3 loop
          rr := g.tokens[s * 4 + k + 1];
          if rr between 0 and 50 and public._ludo_abs(s, rr) = sq then
            g.tokens[s * 4 + k + 1] := -1;
            captured := captured || jsonb_build_object('seat', s, 'token', k, 'from', rr);
          end if;
        end loop;
      end loop;
    end if;
  end if;

  g.last := jsonb_build_object('seat', g.turn, 'token', t, 'from', r, 'to', nr, 'dice', g.dice,
    'captured', captured);

  -- ربح؟
  if (select bool_and(g.tokens[g.turn * 4 + i + 1] = 56) from generate_series(0, 3) i) then
    g.status := 'finished';
    g.winner := g.turn;
    g.phase := null;
    g.deadline := null;
    return g;
  end if;

  if g.dice = 6 or jsonb_array_length(captured) > 0 or nr = 56 then
    g.phase := 'roll';
    g.deadline := public._ludo_deadline(g);
  else
    g := public._ludo_next(g);
  end if;
  return g;
end;
$$;

-- رمي الزهر للي عليه الدور
create function public._ludo_roll(g public.ludo_games)
returns public.ludo_games
language plpgsql
volatile
set search_path = ''
as $$
declare
  moves integer[];
begin
  g.dice := 1 + floor(random() * 6)::integer;
  g.sixes := case when g.dice = 6 then g.sixes + 1 else 0 end;
  g.last := jsonb_build_object('seat', g.turn, 'roll', g.dice);

  if g.sixes = 3 then
    g.last := g.last || '{"three_sixes": true}';
    return public._ludo_next(g);
  end if;

  moves := public._ludo_legal(g);
  if cardinality(moves) = 0 then
    return public._ludo_next(g);
  end if;
  if cardinality(moves) = 1 then
    return public._ludo_move(g, moves[1]);
  end if;
  g.phase := 'move';
  g.deadline := public._ludo_deadline(g);
  return g;
end;
$$;

-- اختيار حجر للكمبيوتر (أو للي ما لعب بوقته):
-- أكل > وصول للوسط > طلوع من البيت > دخول الممر الآمن > الأبعد
create function public._ludo_pick(g public.ludo_games)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  t integer;
  r integer;
  nr integer;
  score integer;
  best integer;
  best_score integer := -1;
begin
  foreach t in array public._ludo_legal(g) loop
    r := g.tokens[g.turn * 4 + t + 1];
    nr := case when r = -1 then 0 else r + g.dice end;
    score := nr;
    if nr = 56 then score := score + 500;
    elsif r = -1 then score := 300;
    elsif nr > 50 then score := score + 100;
    elsif not public._ludo_safe(public._ludo_abs(g.turn, nr)) and exists (
      select 1 from generate_series(0, 15) i
      where i / 4 <> g.turn and g.tokens[i + 1] between 0 and 50
        and public._ludo_abs(i / 4, g.tokens[i + 1]) = public._ludo_abs(g.turn, nr)
    ) then score := score + 1000;
    end if;
    if score > best_score then best := t; best_score := score; end if;
  end loop;
  return best;
end;
$$;

-- السيرفر بيلعب عن اللي عليه الدور (كمبيوتر، أو لاعب خلص وقته)
create function public._ludo_auto(g public.ludo_games)
returns public.ludo_games
language plpgsql
volatile
set search_path = ''
as $$
begin
  if g.phase = 'roll' then
    return public._ludo_roll(g);
  end if;
  return public._ludo_move(g, public._ludo_pick(g));
end;
$$;

create function public._ludo_save(g public.ludo_games)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  g.updated_at := now();
  update public.ludo_games set
    host = g.host, status = g.status, players = g.players, tokens = g.tokens, turn = g.turn,
    phase = g.phase, dice = g.dice, sixes = g.sixes, deadline = g.deadline, winner = g.winner,
    last = g.last, updated_at = g.updated_at
  where id = g.id;
  if g.status = 'finished' and g.winner is not null then
    perform public._ludo_finish(g);
  end if;
  return to_jsonb(g);
end;
$$;

revoke execute on function public._ludo_abs(integer, integer), public._ludo_safe(integer),
  public._ludo_is_bot(public.ludo_games, integer), public._ludo_active(public.ludo_games),
  public._ludo_deadline(public.ludo_games), public._ludo_next(public.ludo_games),
  public._ludo_legal(public.ludo_games), public._ludo_finish(public.ludo_games),
  public._ludo_move(public.ludo_games, integer), public._ludo_roll(public.ludo_games),
  public._ludo_pick(public.ludo_games), public._ludo_auto(public.ludo_games),
  public._ludo_save(public.ludo_games)
from public, anon, authenticated;

-- ===== اللي بيناديه التطبيق =====

create function public._ludo_me_json()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('uid', id, 'pid', public_id, 'name', coalesce(name, 'لاعب'),
    'avatar', avatar, 'seat', 0, 'bot', false, 'left', false)
  from public.profiles where id = auth.uid()
$$;
revoke execute on function public._ludo_me_json() from public, anon, authenticated;

-- طاولة جديدة
create function public.ludo_create()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.ludo_games (host, players)
  values (auth.uid(), jsonb_build_array(public._ludo_me_json()))
  returning id into gid;
  return gid;
end;
$$;

-- انضمام لطاولة بتستنى
create function public.ludo_join(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.ludo_games;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from public.ludo_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if exists (select 1 from jsonb_array_elements(g.players) p where p ->> 'uid' = auth.uid()::text) then
    return to_jsonb(g);
  end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) >= 4 then raise exception 'game full'; end if;
  g.players := g.players || jsonb_set(public._ludo_me_json(), '{seat}', to_jsonb(jsonb_array_length(g.players)));
  return public._ludo_save(g);
end;
$$;

-- صاحب الطاولة بيضيف كمبيوتر
create function public.ludo_add_bot(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.ludo_games;
  n integer;
begin
  select * into g from public.ludo_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  n := jsonb_array_length(g.players);
  if n >= 4 then raise exception 'game full'; end if;
  g.players := g.players || jsonb_build_object('uid', null, 'pid', null,
    'name', (array['الدلّة', 'الفنجان', 'المبخرة'])[1 + (select count(*) from jsonb_array_elements(g.players) p where (p ->> 'bot')::boolean)::integer],
    'avatar', 'dalla', 'seat', n, 'bot', true, 'left', false);
  return public._ludo_save(g);
end;
$$;

-- بدء اللعب (صاحب الطاولة، لاعبين أو أكتر)
create function public.ludo_start(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.ludo_games;
  n integer;
  seats integer[];
  i integer;
begin
  select * into g from public.ludo_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  n := jsonb_array_length(g.players);
  if n < 2 then raise exception 'need 2 players'; end if;
  -- لاعبين: ألوان متقابلة
  seats := case n when 2 then array[0, 2] when 3 then array[0, 1, 2] else array[0, 1, 2, 3] end;
  for i in 0..n - 1 loop
    g.players := jsonb_set(g.players, array[i::text, 'seat'], to_jsonb(seats[i + 1]));
  end loop;
  g.status := 'playing';
  g.tokens := array_fill(-1, array[16]);
  g.turn := 0;
  g.phase := 'roll';
  g.sixes := 0;
  g.dice := null;
  g.last := null;
  g.deadline := public._ludo_deadline(g);
  return public._ludo_save(g);
end;
$$;

-- مقعد اللاعب الحالي بهالطاولة
create function public._ludo_my_seat(g public.ludo_games)
returns integer
language sql
stable
set search_path = ''
as $$
  select (p ->> 'seat')::integer from jsonb_array_elements(g.players) p
  where p ->> 'uid' = auth.uid()::text and not (p ->> 'left')::boolean
$$;
revoke execute on function public._ludo_my_seat(public.ludo_games) from public, anon, authenticated;

create function public.ludo_roll(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.ludo_games;
begin
  select * into g from public.ludo_games where id = gid for update;
  if not found or g.status <> 'playing' then raise exception 'not playing'; end if;
  if public._ludo_my_seat(g) is distinct from g.turn then raise exception 'not your turn'; end if;
  if g.phase <> 'roll' then raise exception 'already rolled'; end if;
  return public._ludo_save(public._ludo_roll(g));
end;
$$;

create function public.ludo_move(gid bigint, token integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.ludo_games;
begin
  select * into g from public.ludo_games where id = gid for update;
  if not found or g.status <> 'playing' then raise exception 'not playing'; end if;
  if public._ludo_my_seat(g) is distinct from g.turn then raise exception 'not your turn'; end if;
  if g.phase <> 'move' then raise exception 'roll first'; end if;
  if not token = any (public._ludo_legal(g)) then raise exception 'illegal move'; end if;
  return public._ludo_save(public._ludo_move(g, token));
end;
$$;

-- أي حدا فاتح الطاولة بيناديها لما يخلص الوقت: السيرفر بيلعب عن اللي عليه الدور
create function public.ludo_tick(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.ludo_games;
begin
  select * into g from public.ludo_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if g.status <> 'playing' or g.deadline > now() then return to_jsonb(g); end if;
  return public._ludo_save(public._ludo_auto(g));
end;
$$;

-- طلوع من الطاولة
create function public.ludo_leave(gid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.ludo_games;
  me text := auth.uid()::text;
  i integer;
  s integer;
  active integer[];
begin
  select * into g from public.ludo_games where id = gid for update;
  if not found or g.status = 'finished' then return; end if;
  select (ord - 1)::integer into i from jsonb_array_elements(g.players) with ordinality as x(p, ord)
  where p ->> 'uid' = me;
  if i is null then return; end if;

  if g.status = 'waiting' then
    g.players := g.players - i;
    -- ترتيب المقاعد من جديد
    for s in 0..jsonb_array_length(g.players) - 1 loop
      g.players := jsonb_set(g.players, array[s::text, 'seat'], to_jsonb(s));
    end loop;
    if g.host = auth.uid() then
      g.host := (select (p ->> 'uid')::uuid from jsonb_array_elements(g.players) p
                 where not (p ->> 'bot')::boolean limit 1);
    end if;
    if g.host is null then g.status := 'finished'; end if;
    perform public._ludo_save(g);
    return;
  end if;

  s := (g.players -> i ->> 'seat')::integer;
  g.players := jsonb_set(g.players, array[i::text, 'left'], 'true');
  active := public._ludo_active(g);
  -- إذا ما ضل غير لاعب واحد، هو الرابح
  if cardinality(active) = 1 then
    g.status := 'finished';
    g.winner := active[1];
    g.phase := null;
    g.deadline := null;
  elsif not exists (select 1 from jsonb_array_elements(g.players) p
                    where not (p ->> 'left')::boolean and not (p ->> 'bot')::boolean) then
    -- ما ضل غير كمبيوتر
    g.status := 'finished';
    g.phase := null;
    g.deadline := null;
  elsif g.turn = s then
    g := public._ludo_next(g);
  end if;
  perform public._ludo_save(g);
end;
$$;

grant execute on function public.ludo_create(), public.ludo_join(bigint), public.ludo_add_bot(bigint),
  public.ludo_start(bigint), public.ludo_roll(bigint), public.ludo_move(bigint, integer),
  public.ludo_tick(bigint), public.ludo_leave(bigint)
to authenticated;
revoke execute on function public.ludo_create(), public.ludo_join(bigint), public.ludo_add_bot(bigint),
  public.ludo_start(bigint), public.ludo_roll(bigint), public.ludo_move(bigint, integer),
  public.ludo_tick(bigint), public.ludo_leave(bigint)
from public, anon;
