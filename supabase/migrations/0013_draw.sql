-- احزر الرسمة
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0012)
--
-- كل دور: واحد بيختار كلمة من ٣ وبيرسمها، والباقي بيكتبوا تخمينهم.
-- اللي بيعرفها أسرع بياخد نقاط أكتر (١٠٠ لـ ٣٠٠)، والرسّام بياخد ٥٠ عن كل واحد عرفها.
-- الكلمة مخبّاية بالسيرفر، والتخمين بينفحص هون. الرسمة نفسها بتنبعت لحظياً بين الجوالات.

create table public.draw_words (
  id bigint generated always as identity primary key,
  word text not null unique
);
alter table public.draw_words enable row level security;
revoke all on public.draw_words from anon, authenticated;

insert into public.draw_words (word)
select unnest(array[
  'دلة', 'فنجان', 'نخلة', 'جمل', 'صقر', 'خيمة', 'تمر', 'قهوة', 'شاي', 'سفينة',
  'برج', 'مسجد', 'قمر', 'شمس', 'نجمة', 'سحابة', 'مطر', 'قوس قزح', 'بحر', 'سمكة',
  'قرش', 'حوت', 'أخطبوط', 'سلحفاة', 'قطة', 'كلب', 'حصان', 'أسد', 'فيل', 'زرافة',
  'أرنب', 'دجاجة', 'بطة', 'بقرة', 'خروف', 'فراشة', 'نحلة', 'عنكبوت', 'ثعبان', 'ضفدع',
  'تفاحة', 'موزة', 'بطيخ', 'عنب', 'فراولة', 'برتقالة', 'جزرة', 'طماطم', 'بيضة', 'خبز',
  'بيتزا', 'برجر', 'آيس كريم', 'كيكة', 'حلاوة', 'مندي', 'سيارة', 'طيارة', 'دراجة', 'قطار',
  'باص', 'صاروخ', 'قارب', 'هليكوبتر', 'بيت', 'باب', 'شباك', 'كرسي', 'طاولة', 'سرير',
  'لمبة', 'ساعة', 'جوال', 'تلفزيون', 'كمبيوتر', 'كاميرا', 'سماعة', 'مفتاح', 'قفل', 'مظلة',
  'نظارة', 'قبعة', 'شماغ', 'عقال', 'حذاء', 'قميص', 'خاتم', 'تاج', 'شنطة', 'مقص',
  'قلم', 'كتاب', 'مسطرة', 'كرة', 'كورة', 'مضرب', 'كأس', 'ميدالية', 'هدية', 'بالون',
  'شمعة', 'نار', 'ثلج', 'رجل ثلج', 'شجرة', 'وردة', 'جبل', 'بركان', 'صحراء', 'جزيرة',
  'قلب', 'عين', 'يد', 'رجل', 'أسنان', 'وجه ضاحك', 'شبح', 'روبوت', 'كنز', 'قرصان',
  'ملك', 'ساحر', 'مهرج', 'دب', 'بطريق', 'مبخرة', 'سيف', 'درع', 'طبل', 'جيتار'
]);

create table public.draw_games (
  id bigint generated always as identity (start with 3001) primary key,
  host uuid references public.profiles (id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  -- [{uid, pid, name, avatar, left, score}]
  players jsonb not null default '[]',
  -- ترتيب الرسّامين
  draw_order uuid[] not null default '{}',
  turn integer not null default 0,
  total integer not null default 0,
  drawer uuid,
  -- choosing (بيختار كلمة) / drawing / reveal
  phase text check (phase in ('choosing', 'drawing', 'reveal')),
  -- شكل الكلمة بدون حروف: "_ _ _ _"
  hint text,
  -- [{uid, points}] بالترتيب
  guessed jsonb not null default '[]',
  -- بعد الدور: {word}
  reveal jsonb,
  deadline timestamptz,
  winner uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index draw_games_waiting_idx on public.draw_games (status, updated_at desc);
alter table public.draw_games enable row level security;
revoke all on public.draw_games from anon, authenticated;
grant select on public.draw_games to authenticated;
create policy "everyone can watch draw" on public.draw_games for select to authenticated using (true);
alter publication supabase_realtime add table public.draw_games;

-- الكلمة والخيارات (مخبّاية)
create table public.draw_secrets (
  game_id bigint primary key references public.draw_games (id) on delete cascade,
  choices text[] not null,
  word text
);
alter table public.draw_secrets enable row level security;
revoke all on public.draw_secrets from anon, authenticated;

create table public.draw_results (
  game_id bigint not null references public.draw_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  won boolean not null,
  score integer not null,
  coins integer not null,
  xp integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index draw_results_user_idx on public.draw_results (user_id, created_at desc);
alter table public.draw_results enable row level security;
revoke all on public.draw_results from anon, authenticated;
grant select on public.draw_results to authenticated;
create policy "users read their draw results" on public.draw_results for select to authenticated
  using ((select auth.uid()) = user_id);

-- ===== دوال داخلية =====

-- توحيد الكتابة: بدون مسافات وتشكيل، أ إ آ = ا، ة = ه، ى = ي
create function public._draw_norm(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(regexp_replace(lower(coalesce(t, '')), '[\sً-ْــ]', '', 'g'), 'أإآةى', 'اااهي')
$$;

create function public._draw_active(g public.draw_games)
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg((p ->> 'uid')::uuid), '{}')
  from jsonb_array_elements(g.players) p where not (p ->> 'left')::boolean
$$;

create function public._draw_add_score(g public.draw_games, u uuid, pts integer)
returns public.draw_games
language plpgsql
stable
set search_path = ''
as $$
declare
  i integer;
begin
  select (ord - 1)::integer into i from jsonb_array_elements(g.players) with ordinality as x(p, ord)
  where p ->> 'uid' = u::text;
  if i is not null then
    g.players := jsonb_set(g.players, array[i::text, 'score'], to_jsonb((g.players -> i ->> 'score')::integer + pts));
  end if;
  return g;
end;
$$;

create function public._draw_save(g public.draw_games)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  g.updated_at := now();
  update public.draw_games set
    host = g.host, status = g.status, players = g.players, draw_order = g.draw_order, turn = g.turn,
    total = g.total, drawer = g.drawer, phase = g.phase, hint = g.hint, guessed = g.guessed,
    reveal = g.reveal, deadline = g.deadline, winner = g.winner, updated_at = g.updated_at
  where id = g.id;
  return to_jsonb(g);
end;
$$;

-- الجوائز: الأول ٥٠ XP و١٠٠ عملة (لحد ١٠ باليوم)، والباقي ١٥ XP
create function public._draw_finish(g public.draw_games)
returns public.draw_games
language plpgsql
set search_path = ''
as $$
declare
  p jsonb;
  best integer;
  won boolean;
  c integer;
  today integer;
begin
  select max((q ->> 'score')::integer) into best from jsonb_array_elements(g.players) q where not (q ->> 'left')::boolean;
  select (q ->> 'uid')::uuid into g.winner from jsonb_array_elements(g.players) q
  where not (q ->> 'left')::boolean and (q ->> 'score')::integer = best limit 1;
  g.status := 'finished';
  g.phase := null;
  g.deadline := null;
  for p in select * from jsonb_array_elements(g.players) loop
    won := (p ->> 'score')::integer = best and best > 0 and not (p ->> 'left')::boolean;
    c := 0;
    if won then
      select count(*) into today from public.draw_results
      where user_id = (p ->> 'uid')::uuid and coins > 0 and created_at >= now() - interval '1 day';
      if today < 10 then c := 100; end if;
    end if;
    insert into public.draw_results (game_id, user_id, won, score, coins, xp)
    values (g.id, (p ->> 'uid')::uuid, won, (p ->> 'score')::integer, c, case when won then 50 else 15 end)
    on conflict do nothing;
    if found then
      update public.profiles set xp = xp + case when won then 50 else 15 end, coins = coins + c
      where id = (p ->> 'uid')::uuid;
    end if;
  end loop;
  return g;
end;
$$;

-- الدور الجاي: الرسّام اللي بعده بيختار من ٣ كلمات
create function public._draw_next(g public.draw_games)
returns public.draw_games
language plpgsql
volatile
set search_path = ''
as $$
declare
  n integer := cardinality(g.draw_order);
  active uuid[] := public._draw_active(g);
  k integer := 0;
begin
  if cardinality(active) < 2 then
    return public._draw_finish(g);
  end if;
  loop
    g.turn := g.turn + 1;
    if g.turn > g.total then
      return public._draw_finish(g);
    end if;
    g.drawer := g.draw_order[1 + (g.turn - 1) % n];
    exit when g.drawer = any (active);
    k := k + 1;
    exit when k > n;
  end loop;

  insert into public.draw_secrets (game_id, choices, word)
  values (g.id, (select array_agg(word) from (select word from public.draw_words order by random() limit 3) w), null)
  on conflict (game_id) do update set choices = excluded.choices, word = null;

  g.phase := 'choosing';
  g.hint := null;
  g.guessed := '[]';
  g.reveal := null;
  g.deadline := now() + interval '15 seconds';
  return g;
end;
$$;

create function public._draw_pick(g public.draw_games, idx integer)
returns public.draw_games
language plpgsql
set search_path = ''
as $$
declare
  w text;
begin
  select choices[idx + 1] into w from public.draw_secrets where game_id = g.id;
  if w is null then raise exception 'bad choice'; end if;
  update public.draw_secrets set word = w where game_id = g.id;
  -- كل حرف شَرطة، والمسافة بتضل مسافة
  g.hint := array_to_string(array(
    select case when ch = ' ' then ' ' else '_' end from regexp_split_to_table(w, '') ch
  ), ' ');
  g.phase := 'drawing';
  g.deadline := now() + interval '80 seconds';
  return g;
end;
$$;

create function public._draw_reveal(g public.draw_games)
returns public.draw_games
language plpgsql
set search_path = ''
as $$
begin
  g.phase := 'reveal';
  g.reveal := jsonb_build_object('word', (select word from public.draw_secrets where game_id = g.id));
  g.deadline := now() + interval '5 seconds';
  return g;
end;
$$;

create function public._draw_me_json()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('uid', id, 'pid', public_id, 'name', coalesce(name, 'لاعب'),
    'avatar', avatar, 'left', false, 'score', 0)
  from public.profiles where id = auth.uid()
$$;

revoke execute on function public._draw_norm(text), public._draw_active(public.draw_games),
  public._draw_add_score(public.draw_games, uuid, integer), public._draw_save(public.draw_games),
  public._draw_finish(public.draw_games), public._draw_next(public.draw_games),
  public._draw_pick(public.draw_games, integer), public._draw_reveal(public.draw_games), public._draw_me_json()
from public, anon, authenticated;

-- ===== اللي بيناديه التطبيق =====

create function public.draw_create()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.draw_games (host, players) values (auth.uid(), jsonb_build_array(public._draw_me_json()))
  returning id into gid;
  return gid;
end;
$$;

create function public.draw_join(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.draw_games;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from public.draw_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if exists (select 1 from jsonb_array_elements(g.players) p where p ->> 'uid' = auth.uid()::text) then
    return to_jsonb(g);
  end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) >= 8 then raise exception 'game full'; end if;
  g.players := g.players || public._draw_me_json();
  return public._draw_save(g);
end;
$$;

-- البدء: كل واحد بيرسم مرتين (أو مرة إذا كانوا أكتر من ٤)
create function public.draw_start(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.draw_games;
  n integer;
begin
  select * into g from public.draw_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  n := jsonb_array_length(g.players);
  if n < 2 then raise exception 'need 2 players'; end if;
  select array_agg((p ->> 'uid')::uuid order by random()) into g.draw_order from jsonb_array_elements(g.players) p;
  g.total := n * case when n <= 4 then 2 else 1 end;
  g.turn := 0;
  g.status := 'playing';
  return public._draw_save(public._draw_next(g));
end;
$$;

-- الرسّام بيشوف الخيارات أو كلمته
create function public.draw_secret(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.draw_games;
  s public.draw_secrets;
begin
  select * into g from public.draw_games where id = gid;
  if not found or g.drawer is distinct from auth.uid() then return null; end if;
  select * into s from public.draw_secrets where game_id = gid;
  return jsonb_build_object('choices', to_jsonb(s.choices), 'word', s.word);
end;
$$;

create function public.draw_pick(gid bigint, idx integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.draw_games;
begin
  select * into g from public.draw_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase <> 'choosing' then raise exception 'not choosing'; end if;
  if g.drawer is distinct from auth.uid() then raise exception 'not the drawer'; end if;
  return public._draw_save(public._draw_pick(g, idx));
end;
$$;

-- تخمين: بيرجّع {correct, game}
create function public.draw_guess(gid bigint, guess text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.draw_games;
  w text;
  pts integer;
  left_s numeric;
  others integer;
begin
  select * into g from public.draw_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase <> 'drawing' then
    return jsonb_build_object('correct', false);
  end if;
  if not auth.uid() = any (public._draw_active(g)) or g.drawer = auth.uid() then
    return jsonb_build_object('correct', false);
  end if;
  if exists (select 1 from jsonb_array_elements(g.guessed) x where x ->> 'uid' = auth.uid()::text) then
    return jsonb_build_object('correct', true, 'game', to_jsonb(g));
  end if;

  select word into w from public.draw_secrets where game_id = gid;
  if public._draw_norm(guess) <> public._draw_norm(w) then
    return jsonb_build_object('correct', false);
  end if;

  left_s := greatest(0, extract(epoch from (g.deadline - now())));
  pts := 100 + round(200 * least(1, left_s / 80))::integer;
  g.guessed := g.guessed || jsonb_build_object('uid', auth.uid(), 'points', pts);
  g := public._draw_add_score(g, auth.uid(), pts);
  g := public._draw_add_score(g, g.drawer, 50);

  -- الكل عرفها؟ منكشف فوراً
  others := cardinality(public._draw_active(g)) - 1;
  if jsonb_array_length(g.guessed) >= others then
    g := public._draw_reveal(g);
  end if;
  return jsonb_build_object('correct', true, 'game', public._draw_save(g));
end;
$$;

create function public.draw_tick(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.draw_games;
begin
  select * into g from public.draw_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if g.status <> 'playing' or g.deadline > now() then return to_jsonb(g); end if;
  if g.phase = 'choosing' then
    g := public._draw_pick(g, 0);
  elsif g.phase = 'drawing' then
    g := public._draw_reveal(g);
  else
    g := public._draw_next(g);
  end if;
  return public._draw_save(g);
end;
$$;

create function public.draw_leave(gid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.draw_games;
  i integer;
begin
  select * into g from public.draw_games where id = gid for update;
  if not found or g.status = 'finished' then return; end if;
  select (ord - 1)::integer into i from jsonb_array_elements(g.players) with ordinality as x(p, ord)
  where p ->> 'uid' = auth.uid()::text;
  if i is null then return; end if;

  if g.status = 'waiting' then
    g.players := g.players - i;
    if g.host = auth.uid() then
      g.host := (select (p ->> 'uid')::uuid from jsonb_array_elements(g.players) p limit 1);
    end if;
    if g.host is null then g.status := 'finished'; end if;
  else
    g.players := jsonb_set(g.players, array[i::text, 'left'], 'true');
    if cardinality(public._draw_active(g)) < 2 then
      g := public._draw_finish(g);
    elsif g.drawer = auth.uid() and g.phase <> 'reveal' then
      g := public._draw_reveal(g);
    end if;
  end if;
  perform public._draw_save(g);
end;
$$;

grant execute on function public.draw_create(), public.draw_join(bigint), public.draw_start(bigint),
  public.draw_secret(bigint), public.draw_pick(bigint, integer), public.draw_guess(bigint, text),
  public.draw_tick(bigint), public.draw_leave(bigint)
to authenticated;
revoke execute on function public.draw_create(), public.draw_join(bigint), public.draw_start(bigint),
  public.draw_secret(bigint), public.draw_pick(bigint, integer), public.draw_guess(bigint, text),
  public.draw_tick(bigint), public.draw_leave(bigint)
from public, anon;
